import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { NodeFsTrackboiActions, TrackPatch } from "../../core";
import { projectIdSchema, toolResult, withProject } from "./helpers";

const trackSourceSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("manual") }),
	z.object({ kind: z.literal("branch"), ref: z.string().min(1) }),
]);
const trackDecisionSchema = z.object({
	id: z.string().min(1),
	title: z.string(),
	body: z.string(),
	status: z.enum(["proposed", "accepted", "rejected"]),
	createdAt: z.string(),
	updatedAt: z.string(),
});
const trackReferenceSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(["card", "path", "branch", "worktree", "url"]),
	label: z.string(),
	value: z.string(),
});
const trackActivitySchema = z.object({
	id: z.string().min(1),
	author: z.string(),
	body: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

/**
 * Registers MCP tools for first-class track management and track-file
 * operations.
 */
export function registerTrackTools(server: McpServer, trackboi: NodeFsTrackboiActions): void {
	server.registerTool("list_tracks", {
		title: "List tracks",
		description: "List track contexts for the active project.",
		inputSchema: {
			projectId: projectIdSchema,
		},
	}, ({ projectId }) => toolResult(() => withProject(trackboi, projectId, () => trackboi.listTracks())));

	server.registerTool("get_track", {
		title: "Get track",
		description: "Get one track by id.",
		inputSchema: {
			projectId: projectIdSchema,
			trackId: z.string().min(1),
		},
	}, ({ projectId, trackId }) => toolResult(() => withProject(trackboi, projectId, () => trackboi.getTrack(trackId))));

	server.registerTool("create_track", {
		title: "Create track",
		description: "Create a new track for the active board.",
		inputSchema: {
			projectId: projectIdSchema,
			title: z.string().min(1),
			source: trackSourceSchema.optional(),
			summary: z.string().optional(),
			plan: z.string().optional(),
		},
	}, ({ projectId, title, source, summary, plan }) => toolResult(() => withProject(trackboi, projectId, () => (
		trackboi.createTrack({ title, source, summary, plan })
	))));

	server.registerTool("update_track", {
		title: "Update track",
		description: "Update track details and structured context.",
		inputSchema: {
			projectId: projectIdSchema,
			trackId: z.string().min(1),
			title: z.string().optional(),
			source: trackSourceSchema.optional(),
			summary: z.string().optional(),
			plan: z.string().optional(),
			decisions: z.array(trackDecisionSchema).optional(),
			references: z.array(trackReferenceSchema).optional(),
			activity: z.array(trackActivitySchema).optional(),
		},
	}, ({ projectId, trackId, title, source, summary, plan, decisions, references, activity }) => (
		toolResult(() => withProject(trackboi, projectId, async () => {
			const patch: TrackPatch = {};
			if (title !== undefined) patch.title = title;
			if (source !== undefined) patch.source = source;
			if (summary !== undefined) patch.summary = summary;
			if (plan !== undefined) patch.plan = plan;
			if (decisions !== undefined) patch.decisions = decisions;
			if (references !== undefined) patch.references = references;
			if (activity !== undefined) patch.activity = activity;
			return trackboi.updateTrack(trackId, patch);
		}))
	));

	server.registerTool("delete_track", {
		title: "Delete track",
		description: "Delete a track and unassign linked cards.",
		inputSchema: {
			projectId: projectIdSchema,
			trackId: z.string().min(1),
		},
	}, ({ projectId, trackId }) => toolResult(() => withProject(trackboi, projectId, () => trackboi.deleteTrack(trackId))));

	server.registerTool("write_track_file", {
		title: "Write track file",
		description: "Create or replace a small text attachment file inside a track.",
		inputSchema: {
			projectId: projectIdSchema,
			trackId: z.string().min(1),
			name: z.string().min(1),
			content: z.string(),
			contentType: z.string().optional(),
		},
	}, ({ projectId, trackId, name, content, contentType }) => toolResult(() => withProject(trackboi, projectId, () => (
		trackboi.writeTrackFile({ trackId, name, content, contentType })
	))));

	server.registerTool("delete_track_file", {
		title: "Delete track file",
		description: "Delete a small attachment file from a track.",
		inputSchema: {
			projectId: projectIdSchema,
			trackId: z.string().min(1),
			name: z.string().min(1),
		},
	}, ({ projectId, trackId, name }) => toolResult(() => withProject(trackboi, projectId, () => (
		trackboi.deleteTrackFile(trackId, name)
	))));
}
