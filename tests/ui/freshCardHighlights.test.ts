import { describe, expect, test } from "bun:test";
import { nextTick, ref } from "vue";
import type { ProjectSnapshot } from "../../src/core/types";
import { useFreshCardHighlights } from "../../src/ui/composables/useFreshCardHighlights";

describe("fresh card highlights", () => {
	test("does not mark existing cards as fresh when switching boards", async () => {
		const snapshot = ref<ProjectSnapshot | null>(createSnapshot("board_a", ["card_a"]));
		const highlights = useFreshCardHighlights(snapshot);
		await nextTick();

		expect(highlights.freshCardIds.value.size).toBe(0);

		snapshot.value = createSnapshot("board_b", ["card_b"]);
		await nextTick();

		expect(highlights.freshCardIds.value.size).toBe(0);

		snapshot.value = createSnapshot("board_b", ["card_b", "card_b_new"]);
		await nextTick();

		expect(highlights.freshCardIds.value.has("card_b_new")).toBe(true);
		expect(highlights.freshCardIds.value.has("card_b")).toBe(false);

		snapshot.value = createSnapshot("board_a", ["card_a"]);
		await nextTick();

		expect(highlights.freshCardIds.value.size).toBe(0);
	});
});

function createSnapshot(boardId: string, cardIds: string[]): ProjectSnapshot {
	return {
		project: {
			name: "Trackboi",
			path: "/tmp/project",
		},
		metadata: {
			version: 1,
			name: "Trackboi",
			people: [],
			agents: [],
		},
		git: {
			isGitRepo: true,
			root: "/tmp/project",
			branch: "master",
			detached: false,
			dirty: false,
		},
		board: {
			id: boardId,
			version: 1,
			name: boardId === "board_a" ? "Board A" : "Board B",
			columns: [{ id: "todo", name: "To Do" }],
			customFields: [],
		},
		boards: [
			{ id: "board_a", name: "Board A", status: "ready", worktreeIds: ["wt-main"] },
			{ id: "board_b", name: "Board B", status: "ready", worktreeIds: ["wt-main"] },
		],
		tracks: [],
		cards: cardIds.map((cardId, index) => ({
			id: cardId,
			boardId,
			title: cardId,
			description: "",
			parentId: null,
			scope: { kind: "project", ref: "global" },
			trackId: null,
			column: "todo",
			rank: `a${index}`,
			labels: [],
			assignee: null,
			fieldValues: {},
			comments: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
			createdBy: "person_unknown",
			updatedBy: "person_unknown",
		})),
	};
}
