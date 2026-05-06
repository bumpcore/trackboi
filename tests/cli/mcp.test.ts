import { describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { NodeFsTrackboiActions, ProjectRegistry, ProjectSnapshot, ProjectView } from "../../src/core";
import { createMcpProjectContext, pickAgentProjectPath, withProject } from "../../src/cli/mcp/helpers";
import { registerCardTools } from "../../src/cli/mcp/cardTools";
import { registerBoardTools, registerProjectTools } from "../../src/cli/mcp/projectTools";
import { registerTrackTools } from "../../src/cli/mcp/trackTools";

type CapturedToolHandler = (input: Record<string, unknown>) => CallToolResult | Promise<CallToolResult>;
type CapturedTool = {
	name: string;
	title?: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
	handler: CapturedToolHandler;
};

function createToolCapture() {
	const tools = new Map<string, CapturedTool>();
	const server = {
		registerTool(name: string, config: { title?: string; description?: string; inputSchema?: Record<string, unknown> }, handler: CapturedToolHandler) {
			tools.set(name, {
				name,
				title: config.title,
				description: config.description,
				inputSchema: config.inputSchema,
				handler,
			});
		},
	} as unknown as McpServer;
	return { server, tools };
}

function parseJsonToolResult(result: CallToolResult): unknown {
	const first = result.content[0];
	if (!first || first.type !== "text") throw new Error(`Expected text tool result: ${JSON.stringify(result)}`);
	return JSON.parse(first.text);
}

function createProjectSnapshot(): ProjectSnapshot {
	return {
		project: { name: "backend", path: "/work/backend", storagePath: ".trackboi" },
		metadata: {
			version: 1,
			name: "backend",
			people: [],
			agents: [],
		},
		git: {
			isGitRepo: true,
			root: "/work/backend",
			branch: "main",
			detached: false,
			dirty: false,
			identity: null,
		},
		board: {
			id: "default",
			version: 1,
			name: "Default",
			columns: [
				{ id: "todo", name: "Todo" },
				{ id: "doing", name: "Doing" },
			],
			customFields: [
				{ id: "severity", name: "Severity", type: "select", options: ["Low", "High"] },
			],
		},
		boards: [{ id: "default", name: "Default", status: "ready", worktreeIds: ["/work/backend"] }],
		tracks: [{
			id: "track-release",
			title: "Release",
			slug: "release",
			summary: "Ship the release.",
			brief: "",
			decisions: [],
			references: [],
			files: [],
			createdAt: "2026-04-23T00:00:00.000Z",
			updatedAt: "2026-04-23T00:00:00.000Z",
		}],
		cards: [{
			id: "card_release",
			boardId: "default",
			title: "Cut release",
			description: "",
			parentId: null,
			scope: { kind: "project", ref: "global" },
			trackId: "track-release",
			column: "todo",
			rank: "a0",
			labels: [],
			assignee: null,
			fieldValues: {},
			comments: [],
			createdAt: "2026-04-23T00:00:00.000Z",
			updatedAt: "2026-04-23T00:00:00.000Z",
			createdBy: "agent_boi",
			updatedBy: "agent_boi",
		}],
	};
}

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

describe("mcp agent tool surface", () => {
	test("registers an agent guide with workflow-oriented next steps", async () => {
		const trackboi = createTrackboiActions();
		const context = await createMcpProjectContext(trackboi, "/work/backend");
		const { server, tools } = createToolCapture();

		registerProjectTools(server, trackboi, context);
		registerBoardTools(server, trackboi, context);

		const guide = tools.get("get_agent_guide");
		expect(guide?.description).toContain("recommended trackboi MCP workflow");
		const result = await guide?.handler({});
		if (!result) throw new Error("Missing get_agent_guide result");
		const payload = parseJsonToolResult(result);

		expect(JSON.stringify(payload)).toContain("orient_agent");
		expect(JSON.stringify(payload)).toContain("card");
		expect(JSON.stringify(payload)).toContain("track");
	});

	test("orient_agent returns a one-call project, board, track, and card orientation", async () => {
		const snapshot = createProjectSnapshot();
		const trackboi = createTrackboiActions({
			withScopedContext: async (_context, action) => action(trackboi),
			readDesktopState: async () => ({
				snapshot,
				view: {
					sources: [{
						id: "manual",
						kind: "manual",
						label: "Projects",
						entries: [{ projectPath: "/work/backend", name: "backend", path: "/work/backend", status: "ready" }],
					}],
					activeProjectPath: "/work/backend",
					storageSearchPaths: [".trackboi"],
				},
				worktrees: [{
					id: "/work/backend",
					name: "backend",
					path: "/work/backend",
					branch: "main",
					isPrimary: true,
					storagePath: ".trackboi",
					storageRoot: "/work/backend/.trackboi",
					status: "ready",
					cardCount: 1,
					colorKey: "blue",
				}],
				selectedWorktreeId: "/work/backend",
				selectedBoardId: "default",
			}),
		});
		const context = await createMcpProjectContext(trackboi, "/work/backend");
		const { server, tools } = createToolCapture();

		registerProjectTools(server, trackboi, context);
		const result = await tools.get("orient_agent")?.handler({});
		if (!result) throw new Error("Missing orient_agent result");
		const payload = parseJsonToolResult(result) as {
			guide: { commonFlows: { orient: string[] } };
			board: { activeBoardId: string; columns: Array<{ id: string }> } | null;
			tracks: Array<{ id: string }>;
			cards: { boardId: string | null; items: Array<{ id: string; trackId: string | null }> };
		};

		expect(payload.guide.commonFlows.orient).toEqual(["orient_agent"]);
		expect(payload.board?.activeBoardId).toBe("default");
		expect(payload.board?.columns.map((column) => column.id)).toEqual(["todo", "doing"]);
		expect(payload.tracks.map((track) => track.id)).toEqual(["track-release"]);
		expect(payload.cards.boardId).toBe("default");
		expect(payload.cards.items[0]?.trackId).toBe("track-release");
	});

	test("exposes read_track_file so agents can inspect markdown docs before editing", async () => {
		const trackboi = createTrackboiActions();
		const context = await createMcpProjectContext(trackboi, "/work/backend");
		const { server, tools } = createToolCapture();

		registerTrackTools(server, trackboi, context);

		const readTool = tools.get("read_track_file");
		expect(readTool?.description).toContain("Read one free-form markdown doc");
		expect(readTool?.title).toBe("Read track file");
	});

	test("exposes desktop-parity board, project settings, and app settings tools", async () => {
		const trackboi = createTrackboiActions();
		const context = await createMcpProjectContext(trackboi, "/work/backend");
		const { server, tools } = createToolCapture();

		registerProjectTools(server, trackboi, context);
		registerBoardTools(server, trackboi, context);

		for (const toolName of [
			"get_app_settings",
			"update_editor_preference",
			"update_storage_paths",
			"list_project_people",
			"add_project_person",
			"update_project_person",
			"delete_project_person",
			"update_board",
			"list_board_fields",
			"create_board_field",
			"update_board_field",
			"delete_board_field",
			"move_column",
		]) {
			if (!tools.has(toolName)) throw new Error(`Missing MCP parity tool: ${toolName}`);
		}
	});

	test("card tools expose trackId instead of legacy scope", async () => {
		const trackboi = createTrackboiActions();
		const context = await createMcpProjectContext(trackboi, "/work/backend");
		const { server, tools } = createToolCapture();

		registerCardTools(server, trackboi, context);

		const createCard = tools.get("create_card");
		const updateCard = tools.get("update_card");
		expect(createCard?.description).toContain("trackId");
		expect(updateCard?.description).toContain("trackId");
		expect(createCard?.inputSchema?.trackId).toBeDefined();
		expect(updateCard?.inputSchema?.trackId).toBeDefined();
		expect(createCard?.inputSchema?.scope).toBeUndefined();
		expect(updateCard?.inputSchema?.scope).toBeUndefined();
	});

	test("update_card accepts board custom field values", async () => {
		const trackboi = createTrackboiActions({
			withScopedContext: async (_context, action) => action(trackboi),
			readAppSettings: async () => ({
				version: 1,
				agents: [{ id: "agent_boi", name: "boi", description: "" }],
				agentContexts: [],
				editor: { preferredEditorId: "auto", customCommand: "" },
			}),
			updateCard: async (_cardId, patch) => ({
				id: "card_1",
				boardId: "default",
				title: "Card",
				description: "",
				parentId: null,
				scope: { kind: "project", ref: "global" },
				trackId: null,
				column: "todo",
				rank: "a0",
				labels: [],
				assignee: null,
				fieldValues: patch.fieldValues ?? {},
				comments: [],
				createdAt: "2026-04-23T00:00:00.000Z",
				updatedAt: "2026-04-23T00:00:00.000Z",
				createdBy: "agent_boi",
				updatedBy: patch.actorId ?? "agent_boi",
			}),
		});
		const context = await createMcpProjectContext(trackboi, "/work/backend");
		await context.setCurrentAgentId("agent_boi");
		const { server, tools } = createToolCapture();

		registerCardTools(server, trackboi, context);
		const result = await tools.get("update_card")?.handler({
			cardId: "card_1",
			fieldValues: {
				severity: "High",
				blocked: false,
			},
		});
		if (!result) throw new Error("Missing update_card result");
		const payload = parseJsonToolResult(result);

		expect(JSON.stringify(payload)).toContain("severity");
		expect(JSON.stringify(payload)).toContain("High");
	});
});
