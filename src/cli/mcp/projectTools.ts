import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { NodeFsTrackboiActions } from "../../core";
import { type McpProjectContext, projectIdSchema, requireSnapshot, toolResult, withProject } from "./helpers";

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
}

/**
 * Registers board-level read tools that expose the current board shape without
 * reaching into storage or runtime internals directly.
 */
export function registerBoardTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("list_columns", {
		title: "List columns",
		description: "List board columns for a project.",
		inputSchema: {
			projectId: projectIdSchema,
		},
	}, ({ projectId }) => toolResult(() => withProject(trackboi, context, projectId, async () => {
		const snapshot = await requireSnapshot(trackboi, context, projectId);
		return snapshot.board.columns;
	})));
}
