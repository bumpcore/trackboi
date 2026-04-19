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
	}

	watch(
		() => options.snapshot.value,
		(nextSnapshot) => {
			if (panelMode.value === "create" && nextSnapshot) {
				draft.value.column = draft.value.column || nextSnapshot.board.columns[0]?.id || "todo";
			}
			if (!selectedCard.value) return;
			selectedCard.value = nextSnapshot?.cards.find((card) => card.id === selectedCard.value?.id) ?? null;
			if (!selectedCard.value) {
				panelMode.value = "closed";
				return;
			}
			draft.value = {
				title: selectedCard.value.title,
				description: selectedCard.value.description,
				column: selectedCard.value.column,
			};
			trackId.value = selectedCard.value.trackId ?? NO_TRACK_SELECT_VALUE;
			fieldValues.value = { ...selectedCard.value.fieldValues };
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
		draft.value = {
			title: card.title,
			description: card.description,
			column: card.column,
		};
		trackId.value = card.trackId ?? NO_TRACK_SELECT_VALUE;
		fieldValues.value = { ...card.fieldValues };
		commentBody.value = "";
		subtaskTitle.value = "";
	}

	function closeCardPanel() {
		panelMode.value = "closed";
		selectedCard.value = null;
		commentBody.value = "";
		subtaskTitle.value = "";
	}

	async function submitCard() {
		const title = draft.value.title.trim();
		if (!title) return;

		if (panelMode.value === "create") {
			await options.run(async () => {
				await desktop.createCard({
					title,
					description: draft.value.description,
					column: draft.value.column,
					trackId: trackId.value === NO_TRACK_SELECT_VALUE ? null : trackId.value,
				});
				resetDraft(draft.value.column);
				panelMode.value = "closed";
			});
			return;
		}

		if (!selectedCard.value) return;
		const cardId = selectedCard.value.id;
		const shouldMove = draft.value.column !== selectedCard.value.column;
		await options.run(async () => {
			await desktop.updateCard(cardId, {
				title,
				description: draft.value.description,
				trackId: trackId.value === NO_TRACK_SELECT_VALUE ? null : trackId.value,
				fieldValues: fieldValues.value,
			});
			if (shouldMove) {
				await desktop.moveCard(cardId, draft.value.column, null);
			}
		});
	}

	async function addComment() {
		if (!selectedCard.value) return;
		const body = commentBody.value.trim();
		if (!body) return;

		await options.run(async () => {
			await desktop.addCardComment({
				cardId: selectedCard.value!.id,
				body,
			});
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
					if (selectedCard.value?.id === card.id) closeCardPanel();
				});
			},
		});
	}

	async function createSubtask() {
		if (!selectedCard.value) return;
		const title = subtaskTitle.value.trim();
		if (!title) return;
		const parent = selectedCard.value;
		await options.run(async () => {
			await desktop.createCard({
				title,
				description: "",
				parentId: parent.id,
				column: parent.column,
				trackId: parent.trackId,
			});
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
		createSubtask,
	};
}
