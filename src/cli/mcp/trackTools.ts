import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { NodeFsTrackboiActions, TrackPatch } from "../../core";
import { type McpProjectContext, projectPathSchema, requireAgentId, toolResult, withProject } from "./helpers";

/**
 * Registers MCP tools for first-class track management and track-file
 * operations.
 */
export function registerTrackTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("list_tracks", {
		title: "List tracks",
		description: "List project-wide ongoing workstream tracks. Use tracks to group related cards and durable context across boards.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(() => withProject(trackboi, context, projectPath, (actions) => actions.listTracks())));

	server.registerTool("get_track", {
		title: "Get track",
		description: "Get one track with summary, brief, decisions, references, linked-doc metadata, and board ownership.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
		},
	}, ({ projectPath, trackId }) => toolResult(() => withProject(trackboi, context, projectPath, (actions) => actions.getTrack(trackId))));

	server.registerTool("create_track", {
		title: "Create track",
		description: "Create an ongoing workstream track for durable feature/project context, then link related cards to it.",
		inputSchema: {
			projectPath: projectPathSchema,
			title: z.string().min(1),
			summary: z.string().optional().describe("Short markdown summary of the intent/problem."),
			brief: z.string().optional().describe("Durable markdown context: goals, constraints, desired end state, and working notes."),
		},
	}, ({ projectPath, title, summary, brief }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => (
		actions.createTrack({
			title,
			summary,
			brief,
			actorId: await requireAgentId(trackboi, context),
		})
	))));

	server.registerTool("update_track", {
		title: "Update track",
		description: "Patch track title, summary, or brief. Use decision/reference/doc tools for structured track context.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			title: z.string().optional(),
			summary: z.string().optional().describe("Replace the markdown summary in index.md body."),
			brief: z.string().optional().describe("Replace brief.md markdown content."),
		},
	}, ({ projectPath, trackId, title, summary, brief }) => (
		toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
			const patch: TrackPatch = {};
			if (title !== undefined) patch.title = title;
			if (summary !== undefined) patch.summary = summary;
			if (brief !== undefined) patch.brief = brief;
			patch.actorId = await requireAgentId(trackboi, context);
			return actions.updateTrack(trackId, patch);
		}))
	));

	server.registerTool("delete_track", {
		title: "Delete track",
		description: "Delete a track folder and unassign linked cards. Use only when the workstream context is obsolete.",
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
		description: "Append a track-level decision. Use for durable choices that future agents should not rediscover.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			title: z.string().min(1),
			body: z.string().optional().describe("Markdown rationale or consequence."),
			status: z.enum(["proposed", "accepted", "rejected"]).optional().describe("Decision status. Defaults to proposed."),
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
		description: "Patch one track-level decision by id.",
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
		description: "Remove one track-level decision by id.",
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
		description: "Append a structured reference to a card, repo path, branch, worktree, or URL.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			kind: z.enum(["card", "path", "branch", "worktree", "url"]),
			label: z.string().min(1).describe("Human-readable reference label."),
			value: z.string().min(1).describe("Card id, repo path, branch name, worktree id/path, or URL."),
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
		description: "Patch one structured track reference by id.",
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
		description: "Remove one structured track reference by id.",
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

	server.registerTool("list_track_files", {
		title: "List track files",
		description: "List free-form markdown docs under a track's files folder.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
		},
	}, ({ projectPath, trackId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => (await actions.getTrack(trackId)).files)));

	server.registerTool("read_track_file", {
		title: "Read track file",
		description: "Read one free-form markdown doc from a track. Use after list_track_files before editing an existing doc.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			name: z.string().min(1).describe("Markdown doc name under the track files folder, e.g. context.md."),
		},
	}, ({ projectPath, trackId, name }) => toolResult(() => withProject(trackboi, context, projectPath, (actions) => (
		actions.readTrackFile(trackId, name)
	))));

	server.registerTool("write_track_file", {
		title: "Write track file",
		description: "Create or replace a free-form markdown doc inside a track. Read first before editing existing docs.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			name: z.string().min(1).describe("Markdown doc name. Must stay inside files/ and end in .md."),
			content: z.string().describe("Full markdown content to write."),
			contentType: z.string().optional().describe("Deprecated; track docs are stored as text/markdown."),
		},
	}, ({ projectPath, trackId, name, content, contentType }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		return actions.writeTrackFile({ trackId, name, content, contentType });
	})));

	server.registerTool("delete_track_file", {
		title: "Delete track file",
		description: "Delete a free-form markdown doc from a track.",
		inputSchema: {
			projectPath: projectPathSchema,
			trackId: z.string().min(1),
			name: z.string().min(1).describe("Markdown doc name under the track files folder."),
		},
	}, ({ projectPath, trackId, name }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		return actions.deleteTrackFile(trackId, name);
	})));
}
