import { ref, watch, type Ref } from "vue";
import { desktop } from "@/electron/renderer";
import type { CardDraft, Confirmation } from "@/ui/viewTypes";
import type {
	Card as TrackboiCard,
	CardComment,
	FieldValue,
	ProjectSnapshot,
} from "@/core/types";

type ConfirmationRequester = (confirmation: Confirmation) => void;

type CardWorkflow = {
	draftTitle: Ref<string>;
	draftDescription: Ref<string>;
	draftColumn: Ref<string>;
	draftTargetWorktreeId: Ref<string>;
	draftTrackId: Ref<string>;
	newCardOpen: Ref<boolean>;
	editingCard: Ref<TrackboiCard | null>;
	editCommentAuthor: Ref<string>;
	editCommentBody: Ref<string>;
	editFieldValues: Ref<Record<string, FieldValue>>;
	editDraft: Ref<CardDraft>;
	subtaskTitle: Ref<string>;
	editTargetWorktreeId: Ref<string>;
	editTrackId: Ref<string>;
	openNewCard(columnId?: string): void;
	closeNewCard(): void;
	closeEditingCard(): void;
	createNewCard(): Promise<void>;
	startEditing(card: TrackboiCard): void;
	saveEditingCard(): Promise<void>;
	addCommentToEditingCard(): Promise<void>;
	deleteExistingCard(card: TrackboiCard): Promise<void>;
	createSubtask(): Promise<void>;
};

/**
 * Coordinates new-card and edit-card workflows without letting the app shell
 * accumulate every modal field and mutation pathway.
 */
export function useCardWorkflow(options: {
	snapshot: Ref<ProjectSnapshot | null>;
	selectedWorktreeId: Ref<string | null>;
	selectedTrackId: Ref<string | null>;
	run(action: () => Promise<void>): Promise<void>;
	requestConfirmation: ConfirmationRequester;
}): CardWorkflow {
	const draftTitle = ref("");
	const draftDescription = ref("");
	const draftColumn = ref("todo");
	const draftTargetWorktreeId = ref("");
	const draftTrackId = ref("");
	const newCardOpen = ref(false);

	const editingCard = ref<TrackboiCard | null>(null);
	const editCommentAuthor = ref("You");
	const editCommentBody = ref("");
	const editFieldValues = ref<Record<string, FieldValue>>({});
	const editDraft = ref<CardDraft>({
		title: "",
		description: "",
		column: "todo",
	});
	const subtaskTitle = ref("");
	const editTargetWorktreeId = ref("");
	const editTrackId = ref("");

	watch(
		() => options.snapshot.value,
		(nextSnapshot) => {
			draftColumn.value = nextSnapshot?.board.columns[0]?.id ?? "todo";
			if (!editingCard.value) return;
			editingCard.value = nextSnapshot?.cards.find((card) => card.id === editingCard.value?.id) ?? null;
			editTrackId.value = editingCard.value?.trackId ?? "";
		},
		{ immediate: true },
	);

	function openNewCard(columnId?: string) {
		editingCard.value = null;
		draftColumn.value = columnId ?? options.snapshot.value?.board.columns[0]?.id ?? draftColumn.value;
		draftTargetWorktreeId.value = options.selectedWorktreeId.value ?? "";
		draftTrackId.value = options.selectedTrackId.value ?? "";
		newCardOpen.value = true;
	}

	function closeNewCard() {
		newCardOpen.value = false;
	}

	function closeEditingCard() {
		editingCard.value = null;
		editCommentBody.value = "";
	}

	async function createNewCard() {
		const title = draftTitle.value.trim();
		if (!title) return;

		await options.run(async () => {
			await desktop.createCard({
				title,
				description: draftDescription.value,
				column: draftColumn.value,
				trackId: draftTrackId.value || null,
				targetWorktreeId: draftTargetWorktreeId.value || null,
			});
			draftTitle.value = "";
			draftDescription.value = "";
			draftTrackId.value = options.selectedTrackId.value ?? "";
			newCardOpen.value = false;
		});
	}

	function startEditing(card: TrackboiCard) {
		newCardOpen.value = false;
		editingCard.value = card;
		editDraft.value = {
			title: card.title,
			description: card.description,
			column: card.column,
		};
		editFieldValues.value = { ...card.fieldValues };
		editTrackId.value = card.trackId ?? "";
		editTargetWorktreeId.value = card.originWorktreeId ?? options.selectedWorktreeId.value ?? "";
		subtaskTitle.value = "";
		editCommentBody.value = "";
	}

	async function saveEditingCard() {
		if (!editingCard.value) return;
		const cardId = editingCard.value.id;
		const nextColumn = editDraft.value.column;
		const shouldMove = nextColumn !== editingCard.value.column;

		await options.run(async () => {
			await desktop.updateCard(cardId, {
				title: editDraft.value.title,
				description: editDraft.value.description,
				trackId: editTrackId.value || null,
				fieldValues: editFieldValues.value,
			});
			if (shouldMove) {
				await desktop.moveCard(cardId, nextColumn, null);
			}
			editingCard.value = null;
		});
	}

	async function addCommentToEditingCard() {
		if (!editingCard.value) return;
		const body = editCommentBody.value.trim();
		if (!body) return;

		const timestamp = new Date().toISOString();
		const comment: CardComment = {
			id: crypto.randomUUID(),
			author: editCommentAuthor.value.trim() || "Unknown",
			body,
			createdAt: timestamp,
			updatedAt: timestamp,
		};

		await options.run(async () => {
			await desktop.updateCard(editingCard.value!.id, {
				comments: [...(editingCard.value?.comments ?? []), comment],
			});
			editCommentBody.value = "";
		});
	}

	async function deleteExistingCard(card: TrackboiCard) {
		options.requestConfirmation({
			title: `Delete ${card.title}?`,
			description: "This card file will be removed from the Trackboi store.",
			confirmLabel: "Delete",
			destructive: true,
			onConfirm: async () => {
				await options.run(async () => {
					await desktop.deleteCard(card.id);
					if (editingCard.value?.id === card.id) {
						editingCard.value = null;
					}
				});
			},
		});
	}

	async function createSubtask() {
		if (!editingCard.value) return;
		const title = subtaskTitle.value.trim();
		if (!title) return;

		const parent = editingCard.value;
		await options.run(async () => {
			await desktop.createCard({
				title,
				description: "",
				parentId: parent.id,
				column: parent.column,
				trackId: parent.trackId,
				targetWorktreeId: parent.originWorktreeId ?? options.selectedWorktreeId.value ?? null,
			});
			subtaskTitle.value = "";
		});
	}

	return {
		draftTitle,
		draftDescription,
		draftColumn,
		draftTargetWorktreeId,
		draftTrackId,
		newCardOpen,
		editingCard,
		editCommentAuthor,
		editCommentBody,
		editFieldValues,
		editDraft,
		subtaskTitle,
		editTargetWorktreeId,
		editTrackId,
		openNewCard,
		closeNewCard,
		closeEditingCard,
		createNewCard,
		startEditing,
		saveEditingCard,
		addCommentToEditingCard,
		deleteExistingCard,
		createSubtask,
	};
}
