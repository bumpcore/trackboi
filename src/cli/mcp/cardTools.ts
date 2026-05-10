import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CardPatch, NodeFsTrackboiActions } from "../../core";
import { boardIdSchema, type McpProjectContext, cardIdSchema, columnSchema, getCard, projectPathSchema, requireAgentId, toMcpCard, toolResult, withProject } from "./helpers";

const fieldValuesSchema = z.record(
	z.string(),
	z.union([z.string(), z.number(), z.boolean(), z.null()]),
).describe("Complete replacement map of board custom field id to value.");

/**
 * Registers MCP tools for card reads and card mutations.
 */
export function registerCardTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("list_cards", {
		title: "List cards",
		description: "List executable task cards. Filter by board, column, track, assignee, label, text, or parent before choosing what to change.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			column: z.string().optional(),
			trackId: z.string().nullable().optional(),
			assignee: z.string().nullable().optional(),
			label: z.string().optional(),
			query: z.string().optional(),
			parentId: z.string().nullable().optional().describe("Use null for top-level cards only."),
		},
	}, ({ projectPath, boardId, column, trackId, assignee, label, query, parentId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const needle = query?.trim().toLowerCase();
		return snapshot.cards.filter((card) => (
			(boardId == null || card.boardId === boardId) &&
			(column == null || card.column === column) &&
			(trackId === undefined || card.trackId === trackId) &&
			(assignee === undefined || card.assignee === assignee) &&
			(label == null || card.labels.includes(label)) &&
			(parentId === undefined || card.parentId === parentId) &&
			(!needle || card.title.toLowerCase().includes(needle) || card.description.toLowerCase().includes(needle))
		)).map(toMcpCard);
	})));

	server.registerTool("get_card", {
		title: "Get card",
		description: "Get one task card with markdown body, comments, labels, assignee, column, and track link.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
		},
	}, ({ projectPath, cardId }) => toolResult(() => getCard(trackboi, context, cardId, projectPath)));

	server.registerTool("create_card", {
		title: "Create card",
		description: "Create an executable task card. Link it to trackId when the work belongs to an ongoing feature/workstream; leave trackId omitted or null for board-wide tasks.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			title: z.string().min(1),
			description: z.string().optional().describe("Markdown task body. Include concrete acceptance criteria or handoff context when useful."),
			parentId: z.string().nullable().optional().describe("Parent card id for subtasks, null for a top-level card."),
			column: columnSchema,
			trackId: z.string().nullable().optional().describe("Owning track id. Use null for untracked board-wide tasks."),
		},
	}, ({ projectPath, boardId, title, description, parentId, column, trackId }) => toolResult(() => (
		withProject(trackboi, context, projectPath, async (actions) => actions.createCard({
			boardId,
			title,
			description,
			parentId,
			column,
			trackId,
			actorId: await requireAgentId(trackboi, context),
		}))
	)));

	server.registerTool("update_card", {
		title: "Update card",
		description: "Patch task card fields. Omitted fields are left unchanged; use trackId to link or unlink track ownership and add_card_comment for progress/handoff notes.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
			title: z.string().optional(),
			description: z.string().optional().describe("Replace the markdown task body."),
			parentId: z.string().nullable().optional().describe("Parent card id for subtasks, null to make top-level."),
			column: z.string().optional().describe("Column id. Use list_columns first if unsure."),
			trackId: z.string().nullable().optional().describe("Owning track id, or null to unlink from a track."),
			labels: z.array(z.string()).optional().describe("Complete replacement label list."),
			assignee: z.string().nullable().optional().describe("Person/agent alias, or null to clear."),
			fieldValues: fieldValuesSchema.optional(),
		},
	}, ({ projectPath, cardId, title, description, parentId, column, trackId, labels, assignee, fieldValues }) => (
		toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
			const patch: CardPatch = {};
			if (title !== undefined) patch.title = title;
			if (description !== undefined) patch.description = description;
			if (parentId !== undefined) patch.parentId = parentId;
			if (column !== undefined) patch.column = column;
			if (trackId !== undefined) patch.trackId = trackId;
			if (labels !== undefined) patch.labels = labels;
			if (assignee !== undefined) patch.assignee = assignee;
			if (fieldValues !== undefined) patch.fieldValues = fieldValues;
			patch.actorId = await requireAgentId(trackboi, context);
			return actions.updateCard(cardId, patch);
		}))
	));

	server.registerTool("move_card", {
		title: "Move card",
		description: "Move a task card to a column and optionally position it before another card. Use this for kanban status changes.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
			toColumn: columnSchema,
			beforeCardId: z.string().nullable().optional(),
		},
	}, ({ projectPath, cardId, toColumn, beforeCardId }) => toolResult(() => (
		withProject(trackboi, context, projectPath, async (actions) => {
			await requireAgentId(trackboi, context);
			return actions.moveCard(cardId, toColumn, beforeCardId ?? null);
		})
	)));

	server.registerTool("delete_card", {
		title: "Delete card",
		description: "Delete one task card from Trackboi storage. Prefer comments/status changes unless the task is truly obsolete.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
		},
	}, ({ projectPath, cardId }) => toolResult(() => (
		withProject(trackboi, context, projectPath, async (actions) => {
			await requireAgentId(trackboi, context);
			return actions.deleteCard(cardId);
		})
	)));

	server.registerTool("list_card_comments", {
		title: "List card comments",
		description: "List markdown progress/handoff comments for one task card.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
		},
	}, ({ projectPath, cardId }) => toolResult(async () => (await getCard(trackboi, context, cardId, projectPath)).comments));

	server.registerTool("add_card_comment", {
		title: "Add card comment",
		description: "Append a markdown progress, blocker, verification, or handoff note to a task card.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
			body: z.string().min(1).describe("Markdown comment body. Include what changed, evidence, blockers, or next steps."),
		},
	}, ({ projectPath, cardId, body }) => toolResult(() => (
		withProject(trackboi, context, projectPath, async (actions) => actions.addCardComment({
			cardId,
			body,
			actorId: await requireAgentId(trackboi, context),
		}))
	)));
}
