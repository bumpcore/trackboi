import { computed, type ComputedRef, type Ref } from "vue";
import { buildBoardPresentation } from "@/ui/lib/boardModel";
import type { BoardScopeMode, ChildProgress } from "@/ui/viewTypes";
import type { ProjectSnapshot, Track, WorktreeContext } from "@/core/types";

type BoardPresentationState = {
	boardScopeMode: Ref<BoardScopeMode>;
	boardScopeOptions: ComputedRef<Array<{ value: BoardScopeMode; label: string }>>;
	allColumnCardCounts: ComputedRef<Record<string, number>>;
	boardPresentation: ComputedRef<ReturnType<typeof buildBoardPresentation>>;
	cardsByColumn: ComputedRef<ReturnType<typeof buildBoardPresentation>["cardsByColumn"]>;
	childProgress: ComputedRef<Record<string, ChildProgress>>;
	editingSubtasks: ComputedRef<ReturnType<typeof buildBoardPresentation>["editingSubtasks"]>;
	editingSubtaskProgress: ComputedRef<ChildProgress>;
	totalCards: ComputedRef<number>;
	visibleCardCount: ComputedRef<number>;
	scopeEmptyMessage: ComputedRef<string | null>;
};

/**
 * Centralizes board filtering and presentation derivation so the screen shell
 * and card workflow can read one consistent view model.
 */
export function useBoardPresentationState(options: {
	snapshot: Ref<ProjectSnapshot | null>;
	boardScopeMode: Ref<BoardScopeMode>;
	selectedTrack: ComputedRef<Track | null>;
	selectedTrackId: Ref<string | null>;
	selectedWorktree: ComputedRef<WorktreeContext | null>;
	worktreeFilterId: Ref<string | null>;
	editingCardId: ComputedRef<string | null>;
}): BoardPresentationState {
	const boardScopeOptions = computed(() => [
		{ value: "all" as const, label: "All cards" },
		{ value: "global" as const, label: "Global only" },
	]);
	const allColumnCardCounts = computed(() => {
		const counts: Record<string, number> = {};
		for (const column of options.snapshot.value?.board.columns ?? []) {
			counts[column.id] = 0;
		}
		for (const card of options.snapshot.value?.cards ?? []) {
			counts[card.column] = (counts[card.column] ?? 0) + 1;
		}
		return counts;
	});
	const boardPresentation = computed(() => buildBoardPresentation({
		cards: options.snapshot.value?.cards ?? [],
		columns: options.snapshot.value?.board.columns ?? [],
		boardScopeMode: options.boardScopeMode.value,
		selectedTrackId: options.selectedTrackId.value,
		worktreeFilterId: options.worktreeFilterId.value,
		editingCardId: options.editingCardId.value,
	}));
	const cardsByColumn = computed(() => boardPresentation.value.cardsByColumn);
	const childProgress = computed<Record<string, ChildProgress>>(() => boardPresentation.value.childProgress);
	const editingSubtasks = computed(() => boardPresentation.value.editingSubtasks);
	const editingSubtaskProgress = computed(() => {
		const editingCardId = options.editingCardId.value;
		if (!editingCardId) return { total: 0, done: 0 };
		return boardPresentation.value.childProgress[editingCardId] ?? { total: 0, done: 0 };
	});
	const totalCards = computed(() => options.snapshot.value?.cards.length ?? 0);
	const visibleCardCount = computed(() => boardPresentation.value.visibleCardCount);
	const scopeEmptyMessage = computed(() => {
		if (!options.snapshot.value || visibleCardCount.value > 0) return null;
		if (options.worktreeFilterId.value && options.selectedWorktree.value) {
			return `No cards for ${options.selectedWorktree.value.name} yet.`;
		}
		if (options.boardScopeMode.value === "global") {
			return "No global project cards yet.";
		}
		if (options.selectedTrack.value) {
			return `No cards in ${options.selectedTrack.value.title} yet.`;
		}
		if (totalCards.value === 0) {
			return "No cards yet.";
		}
		return null;
	});

	return {
		boardScopeMode: options.boardScopeMode,
		boardScopeOptions,
		allColumnCardCounts,
		boardPresentation,
		cardsByColumn,
		childProgress,
		editingSubtasks,
		editingSubtaskProgress,
		totalCards,
		visibleCardCount,
		scopeEmptyMessage,
	};
}
