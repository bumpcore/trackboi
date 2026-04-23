import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import type { ProjectSnapshot } from "@/core/types";

type FreshCardHighlights = {
	freshCardIds: ComputedRef<Set<string>>;
	clearFreshCard(cardId: string): void;
};

/**
 * Tracks newly appeared card ids within the current project so the board can
 * surface them as lightweight "unread" highlights until the user notices them.
 */
export function useFreshCardHighlights(snapshot: Ref<ProjectSnapshot | null>): FreshCardHighlights {
	const freshCardIdSet = ref(new Set<string>());
	let seededProjectPath: string | null = null;
	const seenCardIdsByBoard = new Map<string, Set<string>>();

	watch(
		() => snapshot.value,
		(nextSnapshot) => {
			const nextProjectPath = nextSnapshot?.project.path ?? null;
			const nextBoardId = nextSnapshot?.board.id ?? null;
			const nextCardIds = new Set(nextSnapshot?.cards.map((card) => card.id) ?? []);

			if (!nextProjectPath || !nextBoardId) {
				seededProjectPath = null;
				seenCardIdsByBoard.clear();
				freshCardIdSet.value = new Set();
				return;
			}

			if (seededProjectPath !== nextProjectPath) {
				seededProjectPath = nextProjectPath;
				seenCardIdsByBoard.clear();
				seenCardIdsByBoard.set(nextBoardId, nextCardIds);
				freshCardIdSet.value = new Set();
				return;
			}

			const seenCardIds = seenCardIdsByBoard.get(nextBoardId);
			if (!seenCardIds) {
				seenCardIdsByBoard.set(nextBoardId, nextCardIds);
				freshCardIdSet.value = new Set(
					[...freshCardIdSet.value].filter((cardId) => nextCardIds.has(cardId)),
				);
				return;
			}

			const nextFreshCardIds = new Set(
				[...freshCardIdSet.value].filter((cardId) => nextCardIds.has(cardId)),
			);
			for (const cardId of nextCardIds) {
				if (!seenCardIds.has(cardId)) nextFreshCardIds.add(cardId);
			}

			seenCardIdsByBoard.set(nextBoardId, nextCardIds);
			freshCardIdSet.value = nextFreshCardIds;
		},
		{ immediate: true },
	);

	function clearFreshCard(cardId: string): void {
		if (!freshCardIdSet.value.has(cardId)) return;

		const nextFreshCardIds = new Set(freshCardIdSet.value);
		nextFreshCardIds.delete(cardId);
		freshCardIdSet.value = nextFreshCardIds;
	}

	return {
		freshCardIds: computed(() => freshCardIdSet.value),
		clearFreshCard,
	};
}
