import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { NodeFsTrackboiActions, TrackPatch } from "../../core";
import { boardIdSchema, type McpProjectContext, projectPathSchema, requireAgentId, toolResult, withProject } from "./helpers";

const trackSourceSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("manual") }),
	z.object({ kind: z.literal("branch"), ref: z.string().min(1) }),
]);

/**
 * Registers MCP tools for first-class track management and track-file
 * operations.
 */
export function registerTrackTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("list_tracks", {
		title: "List tracks",
		description: "List track contexts for the active project.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
		},
	}, ({ projectPath, boardId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		if (boardId) await actions.setActiveBoard(boardId);
		return actions.listTracks();
	})));

	server.registerTool("get_track", {
		title: "Get track",
		description: "Get one track by id.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
		},
	}, ({ projectPath, trackId }) => toolResult(() => withProject(trackboi, context, projectPath, (actions) => actions.getTrack(trackId))));

	server.registerTool("create_track", {
		title: "Create track",
		description: "Create a new track for the active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			title: z.string().min(1),
			source: trackSourceSchema.optional(),
			summary: z.string().optional(),
			plan: z.string().optional(),
		},
	}, ({ projectPath, boardId, title, source, summary, plan }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => (
		actions.createTrack({
			title,
			boardId,
			source,
			summary,
			plan,
			actorId: await requireAgentId(trackboi, context),
		})
	))));

	server.registerTool("update_track", {
		title: "Update track",
		description: "Update top-level track details.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			title: z.string().optional(),
			source: trackSourceSchema.optional(),
			summary: z.string().optional(),
			plan: z.string().optional(),
		},
	}, ({ projectPath, trackId, title, source, summary, plan }) => (
		toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
			const patch: TrackPatch = {};
			if (title !== undefined) patch.title = title;
			if (source !== undefined) patch.source = source;
			if (summary !== undefined) patch.summary = summary;
			if (plan !== undefined) patch.plan = plan;
			patch.actorId = await requireAgentId(trackboi, context);
			return actions.updateTrack(trackId, patch);
		}))
	));

	server.registerTool("delete_track", {
		title: "Delete track",
		description: "Delete a track and unassign linked cards.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
		},
	}, ({ projectPath, trackId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		return actions.deleteTrack(trackId);
	})));

	server.registerTool("add_track_decision", {
		title: "Add track decision",
		description: "Append one decision entry to a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			title: z.string().min(1),
			body: z.string().optional(),
			status: z.enum(["proposed", "accepted", "rejected"]).optional(),
		},
	}, ({ projectPath, trackId, title, body, status }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		const timestamp = new Date().toISOString();
		return actions.updateTrack(trackId, {
			decisions: [...track.decisions, {
				id: `decision_${Date.now().toString(36)}`,
				title,
				body: body ?? "",
				status: status ?? "proposed",
				createdAt: timestamp,
				updatedAt: timestamp,
			}],
			actorId,
		});
	})));

	server.registerTool("update_track_decision", {
		title: "Update track decision",
		description: "Patch one decision entry on a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			decisionId: z.string().min(1),
			title: z.string().optional(),
			body: z.string().optional(),
			status: z.enum(["proposed", "accepted", "rejected"]).optional(),
		},
	}, ({ projectPath, trackId, decisionId, title, body, status }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		if (!track.decisions.some((decision) => decision.id === decisionId)) throw new Error(`Unknown track decision: ${decisionId}`);
		return actions.updateTrack(trackId, {
			decisions: track.decisions.map((decision) => decision.id === decisionId ? {
				...decision,
				title: title ?? decision.title,
				body: body ?? decision.body,
				status: status ?? decision.status,
				updatedAt: new Date().toISOString(),
			} : decision),
			actorId,
		});
	})));

	server.registerTool("remove_track_decision", {
		title: "Remove track decision",
		description: "Remove one decision entry from a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			decisionId: z.string().min(1),
		},
	}, ({ projectPath, trackId, decisionId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		return actions.updateTrack(trackId, {
			decisions: track.decisions.filter((decision) => decision.id !== decisionId),
			actorId,
		});
	})));

	server.registerTool("add_track_reference", {
		title: "Add track reference",
		description: "Append one reference entry to a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			kind: z.enum(["card", "path", "branch", "worktree", "url"]),
			label: z.string().min(1),
			value: z.string().min(1),
		},
	}, ({ projectPath, trackId, kind, label, value }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		return actions.updateTrack(trackId, {
			references: [...track.references, {
				id: `reference_${Date.now().toString(36)}`,
				kind,
				label,
				value,
			}],
			actorId,
		});
	})));

	server.registerTool("update_track_reference", {
		title: "Update track reference",
		description: "Patch one reference entry on a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			referenceId: z.string().min(1),
			kind: z.enum(["card", "path", "branch", "worktree", "url"]).optional(),
			label: z.string().optional(),
			value: z.string().optional(),
		},
	}, ({ projectPath, trackId, referenceId, kind, label, value }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		if (!track.references.some((reference) => reference.id === referenceId)) throw new Error(`Unknown track reference: ${referenceId}`);
		return actions.updateTrack(trackId, {
			references: track.references.map((reference) => reference.id === referenceId ? {
				...reference,
				kind: kind ?? reference.kind,
				label: label ?? reference.label,
				value: value ?? reference.value,
			} : reference),
			actorId,
		});
	})));

	server.registerTool("remove_track_reference", {
		title: "Remove track reference",
		description: "Remove one reference entry from a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			referenceId: z.string().min(1),
		},
	}, ({ projectPath, trackId, referenceId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		return actions.updateTrack(trackId, {
			references: track.references.filter((reference) => reference.id !== referenceId),
			actorId,
		});
	})));

	server.registerTool("add_track_activity", {
		title: "Add track activity",
		description: "Append one activity entry to a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			body: z.string().min(1),
		},
	}, ({ projectPath, trackId, body }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		const timestamp = new Date().toISOString();
		return actions.updateTrack(trackId, {
			activity: [...track.activity, {
				id: `activity_${Date.now().toString(36)}`,
				cardId: trackId,
				body,
				createdAt: timestamp,
				updatedAt: timestamp,
				createdBy: actorId,
				updatedBy: actorId,
			}],
			actorId,
		});
	})));

	server.registerTool("update_track_activity", {
		title: "Update track activity",
		description: "Patch one activity entry on a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			activityId: z.string().min(1),
			body: z.string().min(1),
		},
	}, ({ projectPath, trackId, activityId, body }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		if (!track.activity.some((entry) => entry.id === activityId)) throw new Error(`Unknown track activity: ${activityId}`);
		return actions.updateTrack(trackId, {
			activity: track.activity.map((entry) => entry.id === activityId ? {
				...entry,
				body,
				updatedAt: new Date().toISOString(),
				updatedBy: actorId,
			} : entry),
			actorId,
		});
	})));

	server.registerTool("remove_track_activity", {
		title: "Remove track activity",
		description: "Remove one activity entry from a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			activityId: z.string().min(1),
		},
	}, ({ projectPath, trackId, activityId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		const actorId = await requireAgentId(trackboi, context);
		const track = await actions.getTrack(trackId);
		return actions.updateTrack(trackId, {
			activity: track.activity.filter((entry) => entry.id !== activityId),
			actorId,
		});
	})));

	server.registerTool("list_track_files", {
		title: "List track files",
		description: "List attachment files for one track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
		},
	}, ({ projectPath, trackId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => (await actions.getTrack(trackId)).files)));

	server.registerTool("write_track_file", {
		title: "Write track file",
		description: "Create or replace a small text attachment file inside a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			name: z.string().min(1),
			content: z.string(),
			contentType: z.string().optional(),
		},
	}, ({ projectPath, trackId, name, content, contentType }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		return actions.writeTrackFile({ trackId, name, content, contentType });
	})));

	server.registerTool("delete_track_file", {
		title: "Delete track file",
		description: "Delete a small attachment file from a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			name: z.string().min(1),
		},
	}, ({ projectPath, trackId, name }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		return actions.deleteTrackFile(trackId, name);
	})));
}
