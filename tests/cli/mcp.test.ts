import { describe, expect, test } from "bun:test";
import type { NodeFsTrackboiActions, ProjectRegistry, ProjectView } from "../../src/core";
import { createMcpProjectContext, pickAgentProjectPath, withProject } from "../../src/cli/mcp/helpers";

function createTrackboiActions(overrides: Partial<NodeFsTrackboiActions> = {}): NodeFsTrackboiActions {
	let registry: ProjectRegistry = {
		projects: [
			{ name: "backend", path: "/work/backend" },
			{ name: "frontend", path: "/work/frontend" },
		],
		activeProjectPath: "/work/frontend",
		storageSearchPaths: [".trackboi"],
		activeWorkspaceFile: null,
		selectedWorktreeId: "/work/frontend",
		selectedBoardId: "frontend-default",
		appSettings: {
			version: 1,
			agents: [],
			agentContexts: [],
			editor: {
				preferredEditorId: "auto",
				customCommand: "",
			},
		},
	};

	const view: ProjectView = {
		sources: [{
			id: "manual",
			kind: "manual",
			label: "Projects",
			entries: [
				{ projectPath: "/work/backend", name: "backend", path: "/work/backend", status: "ready" },
				{ projectPath: "/work/frontend", name: "frontend", path: "/work/frontend", status: "ready" },
			],
		}],
		activeProjectPath: "/work/frontend",
		storageSearchPaths: [".trackboi"],
	};

	return {
		runtime: {} as NodeFsTrackboiActions["runtime"],
		paths: {} as NodeFsTrackboiActions["paths"],
		readRegistry: () => ({ ...registry }),
		writeRegistry: (nextRegistry) => {
			registry = { ...nextRegistry };
			return { ...registry };
		},
		activeSnapshot: async () => null,
		activeSnapshotWithInternals: async () => null,
		invalidateCache: () => {},
		withScopedContext: async (context, action) => {
			const scopedRegistry: ProjectRegistry = {
				...registry,
				activeProjectPath: context.projectPath,
				selectedWorktreeId: context.worktreeId,
				selectedBoardId: context.boardId,
			};
			const scopedActions = createTrackboiActions({
				readRegistry: () => ({ ...scopedRegistry }),
				writeRegistry: (nextRegistry) => {
					Object.assign(scopedRegistry, nextRegistry);
					return { ...scopedRegistry };
				},
			});
			return action(scopedActions);
		},
		getActiveProject: async () => null,
		listProjects: async () => registry,
		listView: async () => ({ ...view, activeProjectPath: registry.activeProjectPath }),
		readDesktopState: async () => ({ snapshot: null, view, worktrees: [], selectedWorktreeId: registry.selectedWorktreeId, selectedBoardId: registry.selectedBoardId }),
		prewarmProjects: async () => {},
		setSelectedWorktree: async () => ({ snapshot: null, view, worktrees: [], selectedWorktreeId: registry.selectedWorktreeId, selectedBoardId: registry.selectedBoardId }),
		listBoards: async () => [],
		setActiveBoard: async (boardId: string) => {
			registry.selectedBoardId = boardId;
			return { snapshot: null, view, worktrees: [], selectedWorktreeId: registry.selectedWorktreeId, selectedBoardId: boardId };
		},
		setStorageSearchPaths: async () => view,
		setActiveWorkspaceFile: async () => view,
		createBoard: async () => ({ project: { name: "backend", path: "/work/backend" }, metadata: {} as never, git: {} as never, board: {} as never, boards: [], tracks: [], cards: [] }),
		deleteBoard: async () => ({ project: { name: "backend", path: "/work/backend" }, metadata: {} as never, git: {} as never, board: {} as never, boards: [], tracks: [], cards: [] }),
		listTracks: async () => [],
		getTrack: async () => { throw new Error("not implemented"); },
		createTrack: async () => { throw new Error("not implemented"); },
		updateTrack: async () => { throw new Error("not implemented"); },
		deleteTrack: async () => ({ ok: true as const }),
		readTrackFile: async () => ({ name: "notes.md", content: "", contentType: "text/plain" }),
		writeTrackFile: async () => ({ name: "notes.md", path: "", contentType: "text/plain", updatedAt: "" }),
		deleteTrackFile: async () => ({ ok: true as const }),
		openWorkspaceFile: async () => null,
		chooseProject: async () => null,
		locateProject: async () => null,
		removeProject: async () => null,
		switchProject: async (projectPath: string) => {
			registry.activeProjectPath = projectPath;
			registry.selectedWorktreeId = projectPath;
			return { snapshot: null, view: { ...view, activeProjectPath: projectPath }, worktrees: [], selectedWorktreeId: registry.selectedWorktreeId, selectedBoardId: registry.selectedBoardId };
		},
		readAppSettings: async () => registry.appSettings,
		updateAppSettings: async (settings) => {
			registry.appSettings = settings;
			return settings;
		},
		createCard: async () => { throw new Error("not implemented"); },
		addCardComment: async () => { throw new Error("not implemented"); },
		updateCard: async () => { throw new Error("not implemented"); },
		updateBoard: async () => { throw new Error("not implemented"); },
		updateProjectPeople: async () => { throw new Error("not implemented"); },
		moveCard: async () => { throw new Error("not implemented"); },
		deleteCard: async () => ({ ok: true as const }),
		...overrides,
	} as NodeFsTrackboiActions;
}

describe("mcp project context", () => {
	test("prefers the cwd project over the desktop active project", () => {
		const projectPath = pickAgentProjectPath({
			sources: [{
				id: "manual",
				kind: "manual",
				label: "Projects",
				entries: [
					{ projectPath: "/work/frontend", name: "frontend", path: "/work/frontend", status: "ready" },
					{ projectPath: "/work/backend", name: "backend", path: "/work/backend", status: "ready" },
				],
			}],
			activeProjectPath: "/work/frontend",
			storageSearchPaths: [".trackboi"],
		}, "/work/backend/src/server");

		expect(projectPath).toBe("/work/backend");
	});

	test("reports an agent-local active project in list view", async () => {
		const context = await createMcpProjectContext(createTrackboiActions(), "/work/backend");
		const view = await context.listView();

		expect(view.agentActiveProjectPath).toBe("/work/backend");
		expect(view.desktopActiveProjectPath).toBe("/work/frontend");
		expect(view.activeProjectPath).toBe("/work/backend");
	});

	test("uses an isolated scoped project without overwriting desktop selection", async () => {
		const trackboi = createTrackboiActions();
		const context = await createMcpProjectContext(trackboi, "/work/backend");
		const result = await withProject(trackboi, context, undefined, (actions) => {
			const registry = actions.readRegistry();
			return {
				activeProjectPath: registry.activeProjectPath,
				selectedWorktreeId: registry.selectedWorktreeId,
				selectedBoardId: registry.selectedBoardId,
			};
		});

		expect(result).toEqual({
			activeProjectPath: "/work/backend",
			selectedWorktreeId: "/work/backend",
			selectedBoardId: null,
		});
		expect(trackboi.readRegistry()).toMatchObject({
			activeProjectPath: "/work/frontend",
			selectedWorktreeId: "/work/frontend",
			selectedBoardId: "frontend-default",
		});
	});

	test("keeps an agent-local board context per project while leaving the desktop board untouched", async () => {
		const trackboi = createTrackboiActions();
		const context = await createMcpProjectContext(trackboi, "/work/backend");

		await context.setCurrentProjectPath("/work/backend");
		await context.setCurrentBoardId("/work/backend", "backend-review");
		const result = await withProject(trackboi, context, "/work/backend", (actions) => actions.readRegistry().selectedBoardId);

		expect(result).toBe("backend-review");
		expect(trackboi.readRegistry().selectedBoardId).toBe("frontend-default");
	});
});
