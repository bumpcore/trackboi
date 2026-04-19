import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { newId } from "../../core/id";
import type { AgentRegistration, AppSettings, NodeFsTrackboiActions } from "../../core";
import { boardIdSchema, type McpProjectContext, projectIdSchema, requireAgentId, requireSnapshot, toolResult, withProject } from "./helpers";

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
	}, () => toolResult(() => withProject(trackboi, context, undefined, () => trackboi.getActiveProject())));

	server.registerTool("list_worktrees", {
		title: "List worktrees",
		description: "List worktree contexts for the agent's active project.",
		inputSchema: {
			projectId: projectIdSchema,
		},
	}, ({ projectId }) => toolResult(async () => {
		const state = await withProject(trackboi, context, projectId, () => trackboi.readDesktopState());
		return state.worktrees;
	}));

	server.registerTool("switch_project", {
		title: "Switch project",
		description: "Switch the MCP agent's active project without changing the desktop app's selected project.",
		inputSchema: {
			projectId: z.string().min(1),
		},
	}, ({ projectId }) => toolResult(async () => {
		await context.setCurrentProjectId(projectId);
		return withProject(trackboi, context, projectId, () => trackboi.getActiveProject());
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
			projectId: projectIdSchema,
		},
	}, ({ projectId }) => toolResult(() => withProject(trackboi, context, projectId, async () => {
		const snapshot = await requireSnapshot(trackboi, context, projectId);
		return {
			activeBoardId: snapshot.board.id,
			boards: snapshot.boards,
		};
	})));

	server.registerTool("set_active_board", {
		title: "Set active board",
		description: "Switch the MCP agent's active board inside a project without changing the desktop UI shell.",
		inputSchema: {
			projectId: projectIdSchema,
			boardId: z.string().min(1),
		},
	}, ({ projectId, boardId }) => toolResult(async () => {
		const resolvedProjectId = projectId ?? await context.currentProjectId();
		if (!resolvedProjectId) throw new Error("Choose a project first");
		await context.setCurrentBoardId(resolvedProjectId, boardId);
		return withProject(trackboi, context, resolvedProjectId, async () => {
			await trackboi.setActiveBoard(boardId);
			return requireSnapshot(trackboi, context, resolvedProjectId);
		});
	}));

	server.registerTool("create_board", {
		title: "Create board",
		description: "Create a new board in the active project and make it the MCP agent's active board.",
		inputSchema: {
			projectId: projectIdSchema,
			name: z.string().min(1),
		},
	}, ({ projectId, name }) => toolResult(async () => {
		const resolvedProjectId = projectId ?? await context.currentProjectId();
		if (!resolvedProjectId) throw new Error("Choose a project first");
		await requireAgentId(trackboi, context);
		const snapshot = await withProject(trackboi, context, resolvedProjectId, () => trackboi.createBoard({ name }));
		await context.setCurrentBoardId(resolvedProjectId, snapshot.board.id);
		return snapshot;
	}));

	server.registerTool("delete_board", {
		title: "Delete board",
		description: "Delete one board from the active project after its cards and tracks have been moved out.",
		inputSchema: {
			projectId: projectIdSchema,
			boardId: z.string().min(1),
		},
	}, ({ projectId, boardId }) => toolResult(async () => {
		const resolvedProjectId = projectId ?? await context.currentProjectId();
		if (!resolvedProjectId) throw new Error("Choose a project first");
		await requireAgentId(trackboi, context);
		const snapshot = await withProject(trackboi, context, resolvedProjectId, () => trackboi.deleteBoard(boardId));
		await context.setCurrentBoardId(resolvedProjectId, snapshot.board.id);
		return snapshot;
	}));

	server.registerTool("list_columns", {
		title: "List columns",
		description: "List columns for the active board, or for one explicit board when boardId is provided.",
		inputSchema: {
			projectId: projectIdSchema,
			boardId: boardIdSchema,
		},
	}, ({ projectId, boardId }) => toolResult(() => withProject(trackboi, context, projectId, async () => {
		if (boardId) await trackboi.setActiveBoard(boardId);
		const snapshot = await requireSnapshot(trackboi, context, projectId);
		return snapshot.board.columns;
	})));
}
