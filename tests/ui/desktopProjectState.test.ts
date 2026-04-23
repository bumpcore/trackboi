import { afterEach, describe, expect, test } from "bun:test";
import type { DesktopState, ProjectSnapshot } from "../../src/core/types";
import {
	resetDesktopProjectStateForTests,
	useDesktopProjectState,
} from "../../src/ui/composables/useDesktopProjectState";

afterEach(() => {
	resetDesktopProjectStateForTests();
});

describe("desktop project state", () => {
	test("optimisticMoveCard updates the local snapshot and rolls back cleanly", () => {
		const store = useDesktopProjectState(() => undefined);
		store.applyDesktopState(createDesktopState());

		const rollback = store.optimisticMoveCard("card_todo", "done", "card_done");
		const movedCard = store.snapshot.value?.cards.find((card) => card.id === "card_todo");

		expect(movedCard?.column).toBe("done");
		expect(movedCard?.rank).not.toBe("a0");
		expect(movedCard?.updatedAt).not.toBe("2026-04-18T10:00:00.000Z");

		rollback();
		const rolledBackCard = store.snapshot.value?.cards.find((card) => card.id === "card_todo");
		expect(rolledBackCard?.column).toBe("todo");
		expect(rolledBackCard?.rank).toBe("a0");
		expect(rolledBackCard?.updatedAt).toBe("2026-04-18T10:00:00.000Z");
	});

	test("cardMoved patches reconcile optimistic card moves with confirmed ranks", () => {
		const store = useDesktopProjectState(() => undefined);
		store.applyDesktopState(createDesktopState());

		store.optimisticMoveCard("card_todo", "done", null);
		store.applyDesktopStorePatch({
			type: "cardMoved",
			cardId: "card_todo",
			toColumn: "done",
			beforeCardId: null,
			rank: "z0",
		});

		const confirmedCard = store.snapshot.value?.cards.find((card) => card.id === "card_todo");
		expect(confirmedCard?.column).toBe("done");
		expect(confirmedCard?.rank).toBe("z0");
	});

	test("run keeps busy scoped when globalBusy is disabled", async () => {
		const store = useDesktopProjectState(() => undefined);
		let resolveDefault: (() => void) | null = null;
		const defaultPending = new Promise<void>((resolve) => {
			resolveDefault = resolve;
		});

		const defaultRun = store.run(async () => {
			await defaultPending;
		});
		expect(store.busy.value).toBe(true);
		resolveDefault?.();
		await defaultRun;
		expect(store.busy.value).toBe(false);

		let resolveScoped: (() => void) | null = null;
		const scopedPending = new Promise<void>((resolve) => {
			resolveScoped = resolve;
		});

		const scopedRun = store.run(async () => {
			await scopedPending;
		}, { globalBusy: false });
		expect(store.busy.value).toBe(false);
		resolveScoped?.();
		await scopedRun;
		expect(store.busy.value).toBe(false);
	});

	test("run can rethrow after recording the error when requested", async () => {
		const store = useDesktopProjectState(() => undefined);
		const failure = new Error("move failed");

		await expect(store.run(async () => {
			throw failure;
		}, { globalBusy: false, rethrow: true })).rejects.toThrow("move failed");
		expect(store.error.value).toBe("move failed");
	});
});

function createDesktopState(): DesktopState {
	return {
		snapshot: createSnapshot(),
		view: {
			sources: [],
			activeProjectPath: "/tmp/project",
			storageSearchPaths: [],
		},
		worktrees: [],
		selectedWorktreeId: null,
		selectedBoardId: "default",
	};
}

function createSnapshot(): ProjectSnapshot {
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
			id: "default",
			version: 1,
			name: "Board",
			columns: [
				{ id: "todo", name: "To Do" },
				{ id: "done", name: "Done" },
			],
			customFields: [],
		},
		boards: [
			{ id: "default", name: "Board", status: "ready", worktreeIds: ["wt-main"] },
		],
		tracks: [],
		cards: [
			{
				id: "card_todo",
				boardId: "default",
				title: "Todo card",
				description: "",
				parentId: null,
				scope: { kind: "project", ref: "global" },
				trackId: null,
				column: "todo",
				rank: "a0",
				labels: [],
				assignee: null,
				fieldValues: {},
				comments: [],
				createdAt: "2026-04-18T10:00:00.000Z",
				updatedAt: "2026-04-18T10:00:00.000Z",
				createdBy: "person_unknown",
				updatedBy: "person_unknown",
			},
			{
				id: "card_done",
				boardId: "default",
				title: "Done card",
				description: "",
				parentId: null,
				scope: { kind: "project", ref: "global" },
				trackId: null,
				column: "done",
				rank: "m0",
				labels: [],
				assignee: null,
				fieldValues: {},
				comments: [],
				createdAt: "2026-04-18T10:00:00.000Z",
				updatedAt: "2026-04-18T10:00:00.000Z",
				createdBy: "person_unknown",
				updatedBy: "person_unknown",
			},
		],
	};
}
