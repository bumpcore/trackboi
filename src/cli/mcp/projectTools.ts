import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { newId } from "../../core/id";
import type { AgentRegistration, AppSettings, NodeFsTrackboiActions } from "../../core";
import { boardIdSchema, type McpProjectContext, projectPathSchema, requireAgentId, requireSnapshot, toolResult, withProject } from "./helpers";

function updateAgents(settings: AppSettings, updater: (agents: AgentRegistration[]) => AgentRegistration[]): AppSettings {
	return {
		...settings,
		agents: updater(settings.agents),
	};
}

/**
 * Registers MCP tools that inspect or switch Trackboi projects and worktrees.
 */
export function registerProjectTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("list_projects", {
		title: "List projects",
		description: "List projects Trackboi can see, grouped by source.",
	}, () => toolResult(() => context.listView()));

	server.registerTool("get_active_project", {
		title: "Get active project",
		description: "Return the agent's active project snapshot, including the unified board, git context, and cards.",
	}, () => toolResult(() => withProject(trackboi, context, undefined, (actions) => actions.getActiveProject())));

	server.registerTool("get_active_context", {
		title: "Get active context",
		description: "Return the MCP agent's isolated project, worktree, board, and agent context next to the desktop selection.",
	}, () => toolResult(async () => context.listView()));

	server.registerTool("list_worktrees", {
		title: "List worktrees",
		description: "List worktree contexts for the agent's active project.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(async () => {
		const state = await withProject(trackboi, context, projectPath, (actions) => actions.readDesktopState());
		return state.worktrees;
	}));

	server.registerTool("switch_project", {
		title: "Switch project",
		description: "Switch the MCP agent's active project without changing the desktop app's selected project.",
		inputSchema: {
			projectPath: z.string().min(1),
		},
	}, ({ projectPath }) => toolResult(async () => {
		await context.setCurrentProjectPath(projectPath);
		return withProject(trackboi, context, projectPath, (actions) => actions.getActiveProject());
	}));

	server.registerTool("set_active_worktree", {
		title: "Set active worktree",
		description: "Switch the MCP agent's active worktree inside a project without changing the desktop app's selected worktree.",
		inputSchema: {
			projectPath: projectPathSchema,
			worktreeId: z.string().min(1),
		},
	}, ({ projectPath, worktreeId }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		const result = await withProject(trackboi, context, resolvedProjectPath, async (actions) => {
			await actions.setSelectedWorktree(worktreeId);
			const snapshot = await actions.getActiveProject();
			return {
				worktreeId,
				snapshot,
			};
		});
		await context.setCurrentWorktreeId(resolvedProjectPath, worktreeId);
		await context.setCurrentBoardId(resolvedProjectPath, result.snapshot?.board.id ?? null);
		return result;
	}));

	server.registerTool("clear_active_worktree", {
		title: "Clear active worktree",
		description: "Clear the MCP agent's explicit worktree selection and fall back to the project's default worktree.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		const result = await withProject(trackboi, context, resolvedProjectPath, async (actions) => {
			const state = await actions.readDesktopState();
			return {
				worktrees: state.worktrees,
				selectedWorktreeId: state.selectedWorktreeId,
				selectedBoardId: state.selectedBoardId,
			};
		});
		await context.setCurrentWorktreeId(resolvedProjectPath, result.selectedWorktreeId);
		await context.setCurrentBoardId(resolvedProjectPath, result.selectedBoardId);
		return result;
	}));

	server.registerTool("list_agents", {
		title: "List agents",
		description: "List globally registered MCP agents and show the active agent for this MCP session.",
	}, () => toolResult(async () => {
		const settings = await trackboi.readAppSettings();
		return {
			activeAgentId: await context.currentAgentId(),
			agents: settings.agents,
		};
	}));

	server.registerTool("register_agent", {
		title: "Register agent",
		description: "Register a new global agent identity and make it active for this MCP session.",
		inputSchema: {
			name: z.string().min(1),
			description: z.string().optional(),
		},
	}, ({ name, description }) => toolResult(async () => {
		const settings = await trackboi.readAppSettings();
		const agent: AgentRegistration = {
			id: newId("agent"),
			name: name.trim(),
			description: description?.trim() ?? "",
		};
		await trackboi.updateAppSettings(updateAgents(settings, (agents) => [...agents, agent]));
		await context.setCurrentAgentId(agent.id);
		return {
			activeAgentId: agent.id,
			agent,
		};
	}));

	server.registerTool("update_agent", {
		title: "Update agent",
		description: "Rename or describe an existing registered agent.",
		inputSchema: {
			agentId: z.string().min(1),
			name: z.string().min(1).optional(),
			description: z.string().optional(),
		},
	}, ({ agentId, name, description }) => toolResult(async () => {
		const settings = await trackboi.readAppSettings();
		let updatedAgent: AgentRegistration | null = null;
		const nextSettings = updateAgents(settings, (agents) => agents.map((agent) => {
			if (agent.id !== agentId) return agent;
			updatedAgent = {
				...agent,
				name: name?.trim() ?? agent.name,
				description: description?.trim() ?? agent.description,
			};
			return updatedAgent;
		}));
		if (!updatedAgent) throw new Error(`Unknown agent: ${agentId}`);
		await trackboi.updateAppSettings(nextSettings);
		return {
			activeAgentId: await context.currentAgentId(),
			agent: updatedAgent,
		};
	}));

	server.registerTool("set_active_agent", {
		title: "Set active agent",
		description: "Set the active registered agent for this MCP session. Required before mutation tools can write.",
		inputSchema: {
			agentId: z.string().min(1),
		},
	}, ({ agentId }) => toolResult(async () => {
		const settings = await trackboi.readAppSettings();
		if (!settings.agents.some((agent) => agent.id === agentId)) throw new Error(`Unknown agent: ${agentId}`);
		await context.setCurrentAgentId(agentId);
		return {
			activeAgentId: await context.currentAgentId(),
		};
	}));
}

/**
 * Registers board-level read tools that expose the current board shape without
 * reaching into storage or runtime internals directly.
 */
export function registerBoardTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("list_boards", {
		title: "List boards",
		description: "List explicit boards for a project and show which ones are stale in the currently selected worktree.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(() => withProject(trackboi, context, projectPath, async () => {
		const snapshot = await requireSnapshot(trackboi, context, projectPath);
		return {
			activeBoardId: snapshot.board.id,
			boards: snapshot.boards,
		};
	})));

	server.registerTool("set_active_board", {
		title: "Set active board",
		description: "Switch the MCP agent's active board inside a project without changing the desktop UI shell.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: z.string().min(1),
		},
	}, ({ projectPath, boardId }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		await context.setCurrentBoardId(resolvedProjectPath, boardId);
		return withProject(trackboi, context, resolvedProjectPath, async (actions) => {
			await actions.setActiveBoard(boardId);
			return actions.getActiveProject();
		});
	}));

	server.registerTool("create_board", {
		title: "Create board",
		description: "Create a new board in the active project and make it the MCP agent's active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			name: z.string().min(1),
		},
	}, ({ projectPath, name }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		await requireAgentId(trackboi, context);
		const snapshot = await withProject(trackboi, context, resolvedProjectPath, (actions) => actions.createBoard({ name }));
		await context.setCurrentBoardId(resolvedProjectPath, snapshot.board.id);
		return snapshot;
	}));

	server.registerTool("delete_board", {
		title: "Delete board",
		description: "Delete one board from the active project after its cards and tracks have been moved out.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: z.string().min(1),
		},
	}, ({ projectPath, boardId }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		await requireAgentId(trackboi, context);
		const snapshot = await withProject(trackboi, context, resolvedProjectPath, (actions) => actions.deleteBoard(boardId));
		await context.setCurrentBoardId(resolvedProjectPath, snapshot.board.id);
		return snapshot;
	}));

	server.registerTool("list_columns", {
		title: "List columns",
		description: "List columns for the active board, or for one explicit board when boardId is provided.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
		},
	}, ({ projectPath, boardId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		return snapshot.board.columns;
	})));

	server.registerTool("create_column", {
		title: "Create column",
		description: "Append a new column to the active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			name: z.string().min(1),
		},
	}, ({ projectPath, boardId, name }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `column-${newId("column").slice(-8)}`;
		let id = slug;
		const existing = new Set(snapshot.board.columns.map((column) => column.id));
		while (existing.has(id)) id = `${slug}-${newId("column").slice(-6)}`;
		const board = {
			...snapshot.board,
			columns: [...snapshot.board.columns, { id, name: name.trim() }],
		};
		return actions.updateBoard(board);
	})));

	server.registerTool("update_column", {
		title: "Update column",
		description: "Rename an existing column on the active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			columnId: z.string().min(1),
			name: z.string().min(1),
		},
	}, ({ projectPath, boardId, columnId, name }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const exists = snapshot.board.columns.some((column) => column.id === columnId);
		if (!exists) throw new Error(`Unknown column: ${columnId}`);
		return actions.updateBoard({
			...snapshot.board,
			columns: snapshot.board.columns.map((column) => column.id === columnId ? { ...column, name: name.trim() } : column),
		});
	})));

	server.registerTool("delete_column", {
		title: "Delete column",
		description: "Delete an empty column from the active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			columnId: z.string().min(1),
		},
	}, ({ projectPath, boardId, columnId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		if (snapshot.board.columns.length <= 1) throw new Error("Board needs at least one column");
		if (snapshot.cards.some((card) => card.column === columnId)) throw new Error("Move or delete cards before removing this column");
		return actions.updateBoard({
			...snapshot.board,
			columns: snapshot.board.columns.filter((column) => column.id !== columnId),
		});
	})));

	server.registerTool("move_column", {
		title: "Move column",
		description: "Reorder a column before another column, or move it to the end when beforeColumnId is null.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			columnId: z.string().min(1),
			beforeColumnId: z.string().nullable().optional(),
		},
	}, ({ projectPath, boardId, columnId, beforeColumnId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const columns = [...snapshot.board.columns];
		const movingIndex = columns.findIndex((column) => column.id === columnId);
		if (movingIndex < 0) throw new Error(`Unknown column: ${columnId}`);
		const [moving] = columns.splice(movingIndex, 1);
		const insertIndex = beforeColumnId
			? columns.findIndex((column) => column.id === beforeColumnId)
			: columns.length;
		if (beforeColumnId && insertIndex < 0) throw new Error(`Unknown column: ${beforeColumnId}`);
		columns.splice(insertIndex < 0 ? columns.length : insertIndex, 0, moving);
		return actions.updateBoard({
			...snapshot.board,
			columns,
		});
	})));
}
