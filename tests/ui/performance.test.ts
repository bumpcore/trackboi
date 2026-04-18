import { describe, expect, test } from "bun:test";
import { performance } from "node:perf_hooks";
import { buildBoardPresentation } from "../../src/ui/lib/boardModel";
import { renderMarkdownPreview } from "../../src/ui/lib/markdown";
import type { Card, Column } from "../../src/core/types";

describe("ui performance", () => {
	test("buildBoardPresentation handles repeated filter toggles without stalling", () => {
		const columns: Column[] = [
			{ id: "todo", name: "To Do" },
			{ id: "doing", name: "Doing" },
			{ id: "review", name: "Review" },
			{ id: "done", name: "Done" },
		];
		const cards = createCards(2400);

		const startedAt = performance.now();
		let visibleCardCount = 0;

		for (let index = 0; index < 24; index += 1) {
			const presentation = buildBoardPresentation({
				cards,
				columns,
				boardScopeMode: index % 2 === 0 ? "all" : "global",
				selectedTrackId: index % 4 === 0 ? `track_${index % 9}` : null,
				worktreeFilterId: index % 3 === 0 ? "wt-main" : index % 3 === 1 ? "wt-feature" : null,
				editingCardId: "card_120",
			});
			visibleCardCount += presentation.visibleCardCount;
		}

		const elapsed = performance.now() - startedAt;
		console.info(`board filter benchmark: ${elapsed.toFixed(2)}ms total for 24 passes`);

		expect(visibleCardCount).toBeGreaterThan(0);
		expect(elapsed).toBeLessThan(250);
	});

	test("renderMarkdownPreview stays fast across repeated board-sized preview sets", () => {
		const descriptions = Array.from({ length: 600 }, (_, index) => (
			index % 8 === 0
				? "## Investigate\n\n- inspect `src/ui/App.vue`\n- compare filter path\n\n```ts\nconst freeze = false\n```"
				: index % 5 === 0
					? "Blocked on worktree sync.\n\nNext agent should verify `.trackboi/cards` and retry drag ordering."
					: "Tighten board derivation and keep markdown previews shallow for the lane surface."
		));

		const startedAt = performance.now();
		const html = descriptions.map((value) => renderMarkdownPreview(value));
		const firstPassElapsed = performance.now() - startedAt;

		const cachedStartedAt = performance.now();
		const cachedHtml = descriptions.map((value) => renderMarkdownPreview(value));
		const cachedElapsed = performance.now() - cachedStartedAt;
		console.info(
			`markdown preview benchmark: first=${firstPassElapsed.toFixed(2)}ms cached=${cachedElapsed.toFixed(2)}ms`,
		);

		expect(html[0]).toContain("Investigate");
		expect(cachedHtml).toEqual(html);
		expect(cachedElapsed).toBeLessThan(firstPassElapsed);
		expect(cachedElapsed).toBeLessThan(40);
	});

	test("buildBoardPresentation filters by selected track and keeps global view untracked", () => {
		const columns: Column[] = [{ id: "todo", name: "To Do" }];
		const cards: Card[] = [
			{
				id: "card_global",
				boardId: "default",
				title: "Global",
				description: "",
				parentId: null,
				scope: { kind: "project", ref: "global" },
				trackId: null,
				column: "todo",
				rank: "000001",
				labels: [],
				assignee: null,
				fieldValues: {},
				comments: [],
				createdAt: "2026-04-18T10:00:00.000Z",
				updatedAt: "2026-04-18T10:00:00.000Z",
			},
			{
				id: "card_track",
				boardId: "default",
				title: "Track-linked",
				description: "",
				parentId: null,
				scope: { kind: "project", ref: "global" },
				trackId: "track_a",
				column: "todo",
				rank: "000002",
				labels: [],
				assignee: null,
				fieldValues: {},
				comments: [],
				createdAt: "2026-04-18T10:00:00.000Z",
				updatedAt: "2026-04-18T10:00:00.000Z",
			},
		];

		const trackOnly = buildBoardPresentation({
			cards,
			columns,
			boardScopeMode: "all",
			selectedTrackId: "track_a",
			worktreeFilterId: null,
			editingCardId: null,
		});
		const globalOnly = buildBoardPresentation({
			cards,
			columns,
			boardScopeMode: "global",
			selectedTrackId: null,
			worktreeFilterId: null,
			editingCardId: null,
		});

		expect(trackOnly.cardsByColumn.todo?.map((card) => card.id)).toEqual(["card_track"]);
		expect(globalOnly.cardsByColumn.todo?.map((card) => card.id)).toEqual(["card_global"]);
	});
});

function createCards(count: number): Card[] {
	const cards: Card[] = [];
	const columns = ["todo", "doing", "review", "done"] as const;
	const worktreeIds = ["wt-main", "wt-feature", "wt-agent"] as const;

	for (let index = 0; index < count; index += 1) {
		const isSubtask = index % 5 === 0;
		cards.push({
			id: `card_${index}`,
			boardId: "default",
			title: `Card ${index}`,
			description: index % 4 === 0
				? "## Note\n\n- inspect filter path\n- keep previews cheap\n\n```ts\nconsole.log('bench')\n```"
				: "Keep this card responsive while switching board filters and worktree views.",
			parentId: isSubtask ? `card_${Math.max(0, index - 1)}` : null,
			scope: index % 3 === 0 ? { kind: "project", ref: "global" } : { kind: "track", ref: `feature/${index % 12}` },
			trackId: index % 3 === 0 ? null : `track_${index % 9}`,
			column: columns[index % columns.length],
			rank: String(index).padStart(6, "0"),
			labels: [],
			assignee: null,
			fieldValues: {},
			comments: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
			worktreeIds: [worktreeIds[index % worktreeIds.length]],
		});
	}

	return cards;
}
