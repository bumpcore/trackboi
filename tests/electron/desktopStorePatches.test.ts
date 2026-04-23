import { describe, expect, test } from "bun:test";
import type { DesktopState, ProjectSnapshot } from "../../src/core/types";
import { buildDesktopStorePatches } from "../../src/electron/main/desktopStorePatches";

describe("desktop store patches", () => {
	test("emits targeted metadata and card patches for localized external changes", () => {
		const previous = createDesktopState();
		const next = createDesktopState({
			metadataName: "Renamed project",
			cards: [
				{
					id: "card_1",
					title: "Updated title",
					column: "todo",
					rank: "a0",
				},
				{
					id: "card_2",
					title: "New card",
					column: "done",
					rank: "b0",
				},
			],
		});

		expect(buildDesktopStorePatches(previous, next)).toEqual([
			{
				type: "worktreesReplaced",
				projectPath: "/tmp/project",
				worktrees: next.worktrees,
			},
			{
				type: "metadataUpdated",
				metadata: next.snapshot!.metadata,
			},
			{
				type: "cardUpserted",
				card: next.snapshot!.cards[0]!,
			},
			{
				type: "cardUpserted",
				card: next.snapshot!.cards[1]!,
			},
		]);
	});

	test("emits worktree and board patches when project context shape changes without replacing the project", () => {
		const previous = createDesktopState();
		const next = createDesktopState({
			worktrees: [
				...previous.worktrees,
				{
					id: "wt-feature",
					name: "feature",
					path: "/tmp/project-feature",
					branch: "feature",
					isPrimary: false,
					storagePath: ".trackboi",
					storageRoot: "/tmp/project-feature/.trackboi",
					status: "ready",
					cardCount: 1,
					colorKey: "feature",
				},
			],
			boardName: "Delivery",
		});

		expect(buildDesktopStorePatches(previous, next)).toEqual([
			{
				type: "worktreesReplaced",
				projectPath: "/tmp/project",
				worktrees: next.worktrees,
			},
			{
				type: "boardUpserted",
				board: next.snapshot!.board,
				boards: next.snapshot!.boards,
				selectedBoardId: "default",
			},
		]);
	});

	test("falls back to full context replacement when the active project changes", () => {
		const previous = createDesktopState();
		const next = createDesktopState({
			projectPath: "/tmp/other",
			projectName: "Other",
			activeProjectPath: "/tmp/other",
		});

		expect(buildDesktopStorePatches(previous, next)).toEqual([
			{ type: "contextReplaced", state: next },
		]);
	});
});

function createDesktopState(overrides: {
	projectPath?: string;
	projectName?: string;
	activeProjectPath?: string;
	metadataName?: string;
	boardName?: string;
	cards?: Array<{ id: string; title: string; column: string; rank: string }>;
	worktrees?: DesktopState["worktrees"];
} = {}): DesktopState {
	const projectPath = overrides.projectPath ?? "/tmp/project";
	const projectName = overrides.projectName ?? "Trackboi";
	const cardsInput = overrides.cards ?? [{ id: "card_1", title: "Card one", column: "todo", rank: "a0" }];
	const snapshot: ProjectSnapshot = {
		project: {
			name: projectName,
			path: projectPath,
		},
		metadata: {
			version: 1,
			name: overrides.metadataName ?? projectName,
			people: [],
			agents: [],
		},
		git: {
			isGitRepo: true,
			root: projectPath,
			branch: "master",
			detached: false,
			dirty: false,
		},
		board: {
			id: "default",
			version: 1,
			name: overrides.boardName ?? "Main board",
			columns: [
				{ id: "todo", name: "To Do" },
				{ id: "done", name: "Done" },
			],
			customFields: [],
		},
		boards: [
			{
				id: "default",
				name: overrides.boardName ?? "Main board",
				status: "ready",
				worktreeIds: ["wt-main"],
			},
		],
		tracks: [],
		cards: cardsInput.map((card) => ({
			id: card.id,
			boardId: "default",
			title: card.title,
			description: "",
			parentId: null,
			scope: { kind: "project", ref: "global" as const },
			trackId: null,
			column: card.column,
			rank: card.rank,
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

	return {
		snapshot,
		view: {
			sources: [],
			activeProjectPath: overrides.activeProjectPath ?? projectPath,
			storageSearchPaths: [],
		},
		worktrees: overrides.worktrees ?? [{
			id: "wt-main",
			name: "main",
			path: projectPath,
			branch: "master",
			isPrimary: true,
			storagePath: ".trackboi",
			storageRoot: `${projectPath}/.trackboi`,
			status: "ready",
			cardCount: snapshot.cards.length,
			colorKey: "main",
		}],
		selectedWorktreeId: "wt-main",
		selectedBoardId: "default",
	};
}
