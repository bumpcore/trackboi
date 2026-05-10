import { ref, watch, type Ref } from "vue";
import { desktop } from "@/electron/renderer";
import type { CardDraft, Confirmation } from "@/ui/viewTypes";
import { NO_TRACK_SELECT_VALUE } from "@/ui/composables/useTrackWorkflow";
import type {
	Card as TrackboiCard,
	FieldValue,
	ProjectSnapshot,
} from "@/core/types";

type ConfirmationRequester = (confirmation: Confirmation) => void;

type CardPanelMode = "closed" | "create" | "edit";

type SyncedCardDraft = {
	cardId: string;
	title: string;
	description: string;
	column: string;
	trackId: string;
	fieldValuesJson: string;
};

type CardWorkflow = {
	panelMode: Ref<CardPanelMode>;
	selectedCard: Ref<TrackboiCard | null>;
	draft: Ref<CardDraft>;
	trackId: Ref<string>;
	fieldValues: Ref<Record<string, FieldValue>>;
	commentBody: Ref<string>;
	subtaskTitle: Ref<string>;
	openCreateCard(columnId?: string): void;
	selectCard(card: TrackboiCard): void;
	openCard(card: TrackboiCard): void;
	closeCardPanel(): void;
	submitCard(): Promise<void>;
	addComment(): Promise<void>;
	deleteCard(card: TrackboiCard): Promise<void>;
	archiveCard(card: TrackboiCard): Promise<void>;
	restoreCard(card: TrackboiCard): Promise<void>;
	createSubtask(): Promise<void>;
};

/**
 * Coordinates the inspector-native card workflow. The shell can treat card
 * creation and editing as one subject while this composable keeps the mutation
 * rules and draft state together.
 */
export function useCardWorkflow(options: {
	snapshot: Ref<ProjectSnapshot | null>;
	selectedTrackId: Ref<string | null>;
	run(action: () => Promise<void>): Promise<void>;
	requestConfirmation: ConfirmationRequester;
	upsertCard(card: TrackboiCard): void;
	removeCard(cardId: string): void;
	addCardComment(comment: TrackboiCard["comments"][number]): void;
}): CardWorkflow {
	const panelMode = ref<CardPanelMode>("closed");
	const selectedCard = ref<TrackboiCard | null>(null);
	const draft = ref<CardDraft>({
		title: "",
		description: "",
		column: "todo",
	});
	const trackId = ref(NO_TRACK_SELECT_VALUE);
	const fieldValues = ref<Record<string, FieldValue>>({});
	const commentBody = ref("");
	const subtaskTitle = ref("");
	let lastSyncedCardDraft: SyncedCardDraft | null = null;

	function syncedDraftForCard(card: TrackboiCard): SyncedCardDraft {
		return {
			cardId: card.id,
			title: card.title,
			description: card.description,
			column: card.column,
			trackId: card.trackId ?? NO_TRACK_SELECT_VALUE,
			fieldValuesJson: JSON.stringify(card.fieldValues ?? {}),
		};
	}

	function currentDraftMatchesLastSynced() {
		if (!lastSyncedCardDraft) return false;
		return (
			draft.value.title === lastSyncedCardDraft.title
			&& draft.value.description === lastSyncedCardDraft.description
			&& draft.value.column === lastSyncedCardDraft.column
			&& trackId.value === lastSyncedCardDraft.trackId
			&& JSON.stringify(fieldValues.value) === lastSyncedCardDraft.fieldValuesJson
		);
	}

	function syncDraftFromCard(card: TrackboiCard) {
		draft.value = {
			title: card.title,
			description: card.description,
			column: card.column,
		};
		trackId.value = card.trackId ?? NO_TRACK_SELECT_VALUE;
		fieldValues.value = { ...card.fieldValues };
		lastSyncedCardDraft = syncedDraftForCard(card);
	}

	function resetDraft(columnId?: string) {
		draft.value = {
			title: "",
			description: "",
			column: columnId ?? options.snapshot.value?.board.columns[0]?.id ?? "todo",
		};
		trackId.value = options.selectedTrackId.value ?? NO_TRACK_SELECT_VALUE;
		fieldValues.value = {};
		commentBody.value = "";
		subtaskTitle.value = "";
		lastSyncedCardDraft = null;
	}

	watch(
		() => options.snapshot.value,
		(nextSnapshot) => {
			if (panelMode.value === "create" && nextSnapshot) {
				draft.value.column = draft.value.column || nextSnapshot.board.columns[0]?.id || "todo";
			}
			if (!selectedCard.value) return;
			const nextSelectedCard = nextSnapshot?.cards.find((card) => card.id === selectedCard.value?.id) ?? null;
			if (!nextSelectedCard) {
				selectedCard.value = null;
				panelMode.value = "closed";
				lastSyncedCardDraft = null;
				return;
			}
			selectedCard.value = nextSelectedCard;
			if (lastSyncedCardDraft?.cardId !== nextSelectedCard.id || currentDraftMatchesLastSynced()) {
				syncDraftFromCard(nextSelectedCard);
			}
		},
		{ immediate: true },
	);

	function openCreateCard(columnId?: string) {
		panelMode.value = "create";
		selectedCard.value = null;
		resetDraft(columnId);
	}

	function selectCard(card: TrackboiCard) {
		selectedCard.value = card;
		if (panelMode.value === "edit") {
			openCard(card);
		}
	}

	function openCard(card: TrackboiCard) {
		panelMode.value = "edit";
		selectedCard.value = card;
		syncDraftFromCard(card);
		commentBody.value = "";
		subtaskTitle.value = "";
	}

	function closeCardPanel() {
		panelMode.value = "closed";
		selectedCard.value = null;
		commentBody.value = "";
		subtaskTitle.value = "";
		lastSyncedCardDraft = null;
	}

	async function submitCard() {
		const title = draft.value.title.trim();
		if (!title) return;

		if (panelMode.value === "create") {
			await options.run(async () => {
				options.upsertCard(await desktop.createCard({
					title,
					description: draft.value.description,
					column: draft.value.column,
					trackId: trackId.value === NO_TRACK_SELECT_VALUE ? null : trackId.value,
				}));
				resetDraft(draft.value.column);
				panelMode.value = "closed";
			});
			return;
		}

		if (!selectedCard.value) return;
		const cardId = selectedCard.value.id;
		const shouldMove = draft.value.column !== selectedCard.value.column;
		await options.run(async () => {
			let updatedCard = await desktop.updateCard(cardId, {
				title,
				description: draft.value.description,
				trackId: trackId.value === NO_TRACK_SELECT_VALUE ? null : trackId.value,
				fieldValues: fieldValues.value,
			});
			options.upsertCard(updatedCard);
			if (shouldMove) {
				updatedCard = await desktop.moveCard(cardId, draft.value.column, null);
				options.upsertCard(updatedCard);
			}
			selectedCard.value = updatedCard;
			syncDraftFromCard(updatedCard);
		});
	}

	async function addComment() {
		if (!selectedCard.value) return;
		const body = commentBody.value.trim();
		if (!body) return;

		await options.run(async () => {
			options.addCardComment(await desktop.addCardComment({
				cardId: selectedCard.value!.id,
				body,
			}));
			commentBody.value = "";
		});
	}

	async function deleteCard(card: TrackboiCard) {
		options.requestConfirmation({
			title: `Delete ${card.title}?`,
			description: "This card file will be removed from the Trackboi store.",
			confirmLabel: "Delete",
			destructive: true,
			onConfirm: async () => {
				await options.run(async () => {
					await desktop.deleteCard(card.id);
					options.removeCard(card.id);
					if (selectedCard.value?.id === card.id) closeCardPanel();
				});
			},
		});
	}

	async function archiveCard(card: TrackboiCard) {
		options.requestConfirmation({
			title: `Archive ${card.title}?`,
			description: "The card stays in storage and can be restored from board settings.",
			confirmLabel: "Archive",
			onConfirm: async () => {
				await options.run(async () => {
					const updated = await desktop.updateCard(card.id, { archivedAt: new Date().toISOString() });
					options.upsertCard(updated);
					if (selectedCard.value?.id === card.id) closeCardPanel();
				});
			},
		});
	}

	async function restoreCard(card: TrackboiCard) {
		await options.run(async () => {
			options.upsertCard(await desktop.updateCard(card.id, { archivedAt: null }));
		});
	}

	async function createSubtask() {
		if (!selectedCard.value) return;
		const title = subtaskTitle.value.trim();
		if (!title) return;
		const parent = selectedCard.value;
		await options.run(async () => {
			options.upsertCard(await desktop.createCard({
				title,
				description: "",
				parentId: parent.id,
				column: parent.column,
				trackId: parent.trackId,
			}));
			subtaskTitle.value = "";
		});
	}

	return {
		panelMode,
		selectedCard,
		draft,
		trackId,
		fieldValues,
		commentBody,
		subtaskTitle,
		openCreateCard,
		selectCard,
		openCard,
		closeCardPanel,
		submitCard,
		addComment,
		deleteCard,
		archiveCard,
		restoreCard,
		createSubtask,
	};
}
