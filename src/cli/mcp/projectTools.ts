import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { NodeFsTrackboiActions } from "../../core";
import { projectIdSchema, requireSnapshot, toolResult, withProject } from "./helpers";

/**
 * Registers MCP tools that inspect or switch Trackboi projects and worktrees.
 */
export function registerProjectTools(server: McpServer, trackboi: NodeFsTrackboiActions): void {
	server.registerTool("list_projects", {
		title: "List projects",
		description: "List projects Trackboi can see, grouped by source.",
	}, () => toolResult(() => trackboi.listView()));

	server.registerTool("get_active_project", {
		title: "Get active project",
		description: "Return the active project snapshot, including the unified board, git context, and cards.",
	}, () => toolResult(() => trackboi.getActiveProject()));

	server.registerTool("list_worktrees", {
		title: "List worktrees",
		description: "List worktree contexts for the active project.",
		inputSchema: {
			projectId: projectIdSchema,
		},
	}, ({ projectId }) => toolResult(async () => {
		const state = await withProject(trackboi, projectId, () => trackboi.readDesktopState());
		return state.worktrees;
	}));

	server.registerTool("switch_project", {
		title: "Switch project",
		description: "Switch Trackboi's active project.",
		inputSchema: {
			projectId: z.string().min(1),
		},
	}, ({ projectId }) => toolResult(() => trackboi.switchProject(projectId)));
}

/**
 * Registers board-level read tools that expose the current board shape without
 * reaching into storage or runtime internals directly.
 */
export function registerBoardTools(server: McpServer, trackboi: NodeFsTrackboiActions): void {
	server.registerTool("list_columns", {
		title: "List columns",
		description: "List board columns for a project.",
		inputSchema: {
			projectId: projectIdSchema,
		},
	}, ({ projectId }) => toolResult(() => withProject(trackboi, projectId, async () => {
		const snapshot = await requireSnapshot(trackboi);
		return snapshot.board.columns;
	})));
}
