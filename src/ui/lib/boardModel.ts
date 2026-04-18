import type { Card, Column } from "@/core/types";
import type { BoardScopeMode, ChildProgress } from "@/ui/viewTypes";

export type BoardPresentation = {
	cardsByColumn: Record<string, Card[]>;
	childProgress: Record<string, ChildProgress>;
	editingSubtasks: Card[];
	visibleParentCards: Card[];
	visibleCardCount: number;
};

type BuildBoardPresentationInput = {
	cards: Card[];
	columns: Column[];
	boardScopeMode: BoardScopeMode;
	selectedTrackId: string | null;
	worktreeFilterId: string | null;
	editingCardId: string | null;
};

export function buildBoardPresentation(input: BuildBoardPresentationInput): BoardPresentation {
	const cardsByColumn: Record<string, Card[]> = Object.fromEntries(
		input.columns.map((column) => [column.id, [] as Card[]]),
	);
	const childProgress: Record<string, ChildProgress> = {};
	const editingSubtasks: Card[] = [];
	const visibleParentCards: Card[] = [];

	for (const card of input.cards) {
		if (input.worktreeFilterId && !(card.worktreeIds?.includes(input.worktreeFilterId) ?? false)) {
			continue;
		}

		if (input.selectedTrackId && card.trackId !== input.selectedTrackId) {
			continue;
		}

		if (input.boardScopeMode === "global" && card.trackId != null) {
			continue;
		}

		if (card.parentId) {
			const progress = childProgress[card.parentId] ?? { total: 0, done: 0 };
			progress.total += 1;
			if (card.column === "done") progress.done += 1;
			childProgress[card.parentId] = progress;

			if (card.parentId === input.editingCardId) {
				editingSubtasks.push(card);
			}
			continue;
		}

		cardsByColumn[card.column]?.push(card);
		visibleParentCards.push(card);
	}

	for (const cards of Object.values(cardsByColumn)) {
		cards.sort(compareCardsByRank);
	}
	editingSubtasks.sort(compareCardsByRank);

	return {
		cardsByColumn,
		childProgress,
		editingSubtasks,
		visibleParentCards,
		visibleCardCount: visibleParentCards.length,
	};
}

function compareCardsByRank(left: Card, right: Card): number {
	return left.rank.localeCompare(right.rank);
}
