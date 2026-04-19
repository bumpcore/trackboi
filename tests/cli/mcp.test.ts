import { describe, expect, test } from "bun:test";
import type { NodeFsTrackboiActions, ProjectRegistry, ProjectView } from "../../src/core";
import { createMcpProjectContext, pickAgentProjectId, withProject } from "../../src/cli/mcp/helpers";

function createTrackboiActions(overrides: Partial<NodeFsTrackboiActions> = {}): NodeFsTrackboiActions {
	let registry: ProjectRegistry = {
		projects: [
			{ id: "backend", name: "backend", path: "/work/backend" },
			{ id: "frontend", name: "frontend", path: "/work/frontend" },
		],
		activeProjectId: "frontend",
		storageSearchPaths: [".trackboi"],
		activeWorkspaceFile: null,
		selectedWorktreeId: "/work/frontend",
	};

	const view: ProjectView = {
		sources: [{
			id: "manual",
			kind: "manual",
			label: "Projects",
			entries: [
				{ projectId: "backend", name: "backend", path: "/work/backend", status: "ready" },
				{ projectId: "frontend", name: "frontend", path: "/work/frontend", status: "ready" },
			],
		}],
		activeProjectId: "frontend",
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
		getActiveProject: async () => null,
		listProjects: async () => registry,
		listView: async () => ({ ...view, activeProjectId: registry.activeProjectId }),
		readDesktopState: async () => ({ snapshot: null, view, worktrees: [], selectedWorktreeId: registry.selectedWorktreeId }),
		prewarmProjects: async () => {},
		setSelectedWorktree: async () => ({ snapshot: null, view, worktrees: [], selectedWorktreeId: registry.selectedWorktreeId }),
		setStorageSearchPaths: async () => view,
		setActiveWorkspaceFile: async () => view,
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
		switchProject: async (projectId: string) => {
			registry.activeProjectId = projectId;
			registry.selectedWorktreeId = `/work/${projectId}`;
			return { snapshot: null, view: { ...view, activeProjectId: projectId }, worktrees: [], selectedWorktreeId: registry.selectedWorktreeId };
		},
		createCard: async () => { throw new Error("not implemented"); },
		updateCard: async () => { throw new Error("not implemented"); },
		updateBoard: async () => { throw new Error("not implemented"); },
		updateCustomFields: async () => { throw new Error("not implemented"); },
		moveCard: async () => { throw new Error("not implemented"); },
		deleteCard: async () => ({ ok: true as const }),
		...overrides,
	} as NodeFsTrackboiActions;
}

describe("mcp project context", () => {
	test("prefers the cwd project over the desktop active project", () => {
		const projectId = pickAgentProjectId({
			sources: [{
				id: "manual",
				kind: "manual",
				label: "Projects",
				entries: [
					{ projectId: "frontend", name: "frontend", path: "/work/frontend", status: "ready" },
					{ projectId: "backend", name: "backend", path: "/work/backend", status: "ready" },
				],
			}],
			activeProjectId: "frontend",
			storageSearchPaths: [".trackboi"],
		}, "/work/backend/src/server");

		expect(projectId).toBe("backend");
	});

	test("reports an agent-local active project in list view", async () => {
		const context = await createMcpProjectContext(createTrackboiActions(), "/work/backend");
		const view = await context.listView();

		expect(view.agentActiveProjectId).toBe("backend");
		expect(view.desktopActiveProjectId).toBe("frontend");
		expect(view.activeProjectId).toBe("backend");
	});

	test("restores desktop project and selected worktree after temporary tool routing", async () => {
		const trackboi = createTrackboiActions();
		const context = await createMcpProjectContext(trackboi, "/work/backend");
		const result = await withProject(trackboi, context, undefined, () => {
			const registry = trackboi.readRegistry();
			return {
				activeProjectId: registry.activeProjectId,
				selectedWorktreeId: registry.selectedWorktreeId,
			};
		});

		expect(result).toEqual({
			activeProjectId: "backend",
			selectedWorktreeId: "/work/backend",
		});
		expect(trackboi.readRegistry()).toMatchObject({
			activeProjectId: "frontend",
			selectedWorktreeId: "/work/frontend",
		});
	});
});
