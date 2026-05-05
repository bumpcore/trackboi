import { describe, expect, test } from "bun:test";
import type { Card, Column } from "../../src/core/types";
import { buildBoardPresentation } from "../../src/ui/lib/boardModel";

const columns: Column[] = [
	{ id: "todo", name: "To Do" },
	{ id: "doing", name: "Doing" },
	{ id: "done", name: "Done" },
];

describe("board presentation model", () => {
	test("initializes empty arrays for every board column", () => {
		const result = buildBoardPresentation(baseInput([]));
		expect(Object.keys(result.cardsByColumn)).toEqual(["todo", "doing", "done"]);
		expect(result.cardsByColumn.todo).toEqual([]);
		expect(result.visibleCardCount).toBe(0);
	});

	test("sorts visible parent cards inside each column by rank", () => {
		const result = buildBoardPresentation(baseInput([
			card("b", { column: "todo", rank: "z" }),
			card("a", { column: "todo", rank: "a" }),
		]));
		expect(result.cardsByColumn.todo.map((entry) => entry.id)).toEqual(["a", "b"]);
	});

	test("does not render cards from unknown columns but still counts them as visible parents", () => {
		const result = buildBoardPresentation(baseInput([
			card("known", { column: "todo" }),
			card("unknown", { column: "later" }),
		]));
		expect(result.cardsByColumn.todo.map((entry) => entry.id)).toEqual(["known"]);
		expect(result.visibleParentCards.map((entry) => entry.id)).toEqual(["known", "unknown"]);
		expect(result.visibleCardCount).toBe(2);
	});

	test("filters by selected board id", () => {
		const result = buildBoardPresentation({
			...baseInput([
				card("default", { boardId: "default" }),
				card("delivery", { boardId: "delivery" }),
			]),
			selectedBoardId: "delivery",
		});
		expect(result.visibleParentCards.map((entry) => entry.id)).toEqual(["delivery"]);
	});

	test("keeps all boards when selected board id is null", () => {
		const result = buildBoardPresentation(baseInput([
			card("default", { boardId: "default" }),
			card("delivery", { boardId: "delivery" }),
		]));
		expect(result.visibleParentCards.map((entry) => entry.id)).toEqual(["default", "delivery"]);
	});

	test("filters by selected track id", () => {
		const result = buildBoardPresentation({
			...baseInput([
				card("track-a", { trackId: "track_a" }),
				card("track-b", { trackId: "track_b" }),
				card("untracked", { trackId: null }),
			]),
			selectedTrackId: "track_a",
		});
		expect(result.visibleParentCards.map((entry) => entry.id)).toEqual(["track-a"]);
	});

	test("global board scope hides tracked cards", () => {
		const result = buildBoardPresentation({
			...baseInput([
				card("tracked", { trackId: "track_a" }),
				card("untracked", { trackId: null }),
			]),
			boardScopeMode: "global",
		});
		expect(result.visibleParentCards.map((entry) => entry.id)).toEqual(["untracked"]);
	});

	test("track filter wins before global scope filtering", () => {
		const result = buildBoardPresentation({
			...baseInput([
				card("tracked", { trackId: "track_a" }),
				card("untracked", { trackId: null }),
			]),
			selectedTrackId: "track_a",
			boardScopeMode: "global",
		});
		expect(result.visibleParentCards).toEqual([]);
	});

	test("subtasks do not appear as visible parent cards", () => {
		const result = buildBoardPresentation(baseInput([
			card("parent"),
			card("child", { parentId: "parent" }),
		]));
		expect(result.visibleParentCards.map((entry) => entry.id)).toEqual(["parent"]);
		expect(result.visibleCardCount).toBe(1);
	});

	test("subtasks increment child progress", () => {
		const result = buildBoardPresentation(baseInput([
			card("parent"),
			card("child-a", { parentId: "parent", column: "todo" }),
			card("child-b", { parentId: "parent", column: "done" }),
		]));
		expect(result.childProgress.parent).toEqual({ total: 2, done: 1 });
	});

	test("done progress is based on column id", () => {
		const result = buildBoardPresentation(baseInput([
			card("parent"),
			card("child-a", { parentId: "parent", column: "Done" }),
			card("child-b", { parentId: "parent", column: "done" }),
		]));
		expect(result.childProgress.parent).toEqual({ total: 2, done: 1 });
	});

	test("editing subtasks only includes children of the editing card", () => {
		const result = buildBoardPresentation({
			...baseInput([
				card("parent-a"),
				card("parent-b"),
				card("child-a", { parentId: "parent-a" }),
				card("child-b", { parentId: "parent-b" }),
			]),
			editingCardId: "parent-a",
		});
		expect(result.editingSubtasks.map((entry) => entry.id)).toEqual(["child-a"]);
	});

	test("editing subtasks are sorted by rank", () => {
		const result = buildBoardPresentation({
			...baseInput([
				card("parent"),
				card("child-b", { parentId: "parent", rank: "z" }),
				card("child-a", { parentId: "parent", rank: "a" }),
			]),
			editingCardId: "parent",
		});
		expect(result.editingSubtasks.map((entry) => entry.id)).toEqual(["child-a", "child-b"]);
	});

	test("filtered-out children do not affect progress", () => {
		const result = buildBoardPresentation({
			...baseInput([
				card("parent", { boardId: "default" }),
				card("child", { boardId: "other", parentId: "parent", column: "done" }),
			]),
			selectedBoardId: "default",
		});
		expect(result.childProgress.parent).toBeUndefined();
	});

	test("track-filtered children still update progress for visible track context", () => {
		const result = buildBoardPresentation({
			...baseInput([
				card("parent", { trackId: "track_a" }),
				card("child", { parentId: "parent", trackId: "track_a", column: "done" }),
				card("other-child", { parentId: "parent", trackId: "track_b", column: "done" }),
			]),
			selectedTrackId: "track_a",
		});
		expect(result.childProgress.parent).toEqual({ total: 1, done: 1 });
	});

	test("visible parent cards preserve input order across columns", () => {
		const result = buildBoardPresentation(baseInput([
			card("doing", { column: "doing", rank: "a" }),
			card("todo", { column: "todo", rank: "a" }),
		]));
		expect(result.visibleParentCards.map((entry) => entry.id)).toEqual(["doing", "todo"]);
	});

	test("column sorting is independent per column", () => {
		const result = buildBoardPresentation(baseInput([
			card("todo-b", { column: "todo", rank: "z" }),
			card("doing-b", { column: "doing", rank: "z" }),
			card("todo-a", { column: "todo", rank: "a" }),
			card("doing-a", { column: "doing", rank: "a" }),
		]));
		expect(result.cardsByColumn.todo.map((entry) => entry.id)).toEqual(["todo-a", "todo-b"]);
		expect(result.cardsByColumn.doing.map((entry) => entry.id)).toEqual(["doing-a", "doing-b"]);
	});
});

function baseInput(cards: Card[]) {
	return {
		cards,
		columns,
		selectedBoardId: null,
		boardScopeMode: "all" as const,
		selectedTrackId: null,
		editingCardId: null,
	};
}

function card(id: string, overrides: Partial<Card> = {}): Card {
	return {
		id,
		boardId: "default",
		title: id,
		description: "",
		parentId: null,
		scope: { kind: "project", ref: "global" },
		trackId: null,
		column: "todo",
		rank: "m",
		labels: [],
		assignee: null,
		fieldValues: {},
		comments: [],
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		createdBy: "person_fixture",
		updatedBy: "person_fixture",
		...overrides,
	};
}
