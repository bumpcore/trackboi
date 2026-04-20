import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CardPatch, NodeFsTrackboiActions } from "../../core";
import { boardIdSchema, type McpProjectContext, cardIdSchema, columnSchema, getCard, projectPathSchema, requireAgentId, scopeSchema, toolResult, withProject } from "./helpers";

/**
 * Registers MCP tools for card reads and card mutations.
 */
export function registerCardTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("list_cards", {
		title: "List cards",
		description: "List cards for a project. Supports board, column, track, assignee, label, text, and parent filtering.",
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
		));
	})));

	server.registerTool("get_card", {
		title: "Get card",
		description: "Get one card by id.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
		},
	}, ({ projectPath, cardId }) => toolResult(() => getCard(trackboi, context, cardId, projectPath)));

	server.registerTool("create_card", {
		title: "Create card",
		description: "Create a card in a project.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			title: z.string().min(1),
			description: z.string().optional(),
			parentId: z.string().nullable().optional(),
			column: columnSchema,
			scope: scopeSchema.optional(),
			trackId: z.string().nullable().optional(),
		},
	}, ({ projectPath, boardId, title, description, parentId, column, scope, trackId }) => toolResult(() => (
		withProject(trackboi, context, projectPath, async (actions) => actions.createCard({
			boardId,
			title,
			description,
			parentId,
			column,
			scope,
			trackId,
			actorId: await requireAgentId(trackboi, context),
		}))
	)));

	server.registerTool("update_card", {
		title: "Update card",
		description: "Patch card fields. Omitted fields are left unchanged.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
			title: z.string().optional(),
			description: z.string().optional(),
			parentId: z.string().nullable().optional(),
			column: z.string().optional(),
			scope: scopeSchema.optional(),
			trackId: z.string().nullable().optional(),
			labels: z.array(z.string()).optional(),
			assignee: z.string().nullable().optional(),
		},
	}, ({ projectPath, cardId, title, description, parentId, column, scope, trackId, labels, assignee }) => (
		toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
			const patch: CardPatch = {};
			if (title !== undefined) patch.title = title;
			if (description !== undefined) patch.description = description;
			if (parentId !== undefined) patch.parentId = parentId;
			if (column !== undefined) patch.column = column;
			if (scope !== undefined) patch.scope = scope;
			if (trackId !== undefined) patch.trackId = trackId;
			if (labels !== undefined) patch.labels = labels;
			if (assignee !== undefined) patch.assignee = assignee;
			patch.actorId = await requireAgentId(trackboi, context);
			return actions.updateCard(cardId, patch);
		}))
	));

	server.registerTool("move_card", {
		title: "Move card",
		description: "Move a card to a column and optionally position it before another card.",
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
		description: "Delete one card file from Trackboi storage.",
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
		description: "List markdown comments for one card.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
		},
	}, ({ projectPath, cardId }) => toolResult(async () => (await getCard(trackboi, context, cardId, projectPath)).comments));

	server.registerTool("add_card_comment", {
		title: "Add card comment",
		description: "Add a markdown comment file under one card's comments folder.",
		inputSchema: {
			projectPath: projectPathSchema,
			cardId: cardIdSchema,
			body: z.string().min(1),
		},
	}, ({ projectPath, cardId, body }) => toolResult(() => (
		withProject(trackboi, context, projectPath, async (actions) => actions.addCardComment({
			cardId,
			body,
			actorId: await requireAgentId(trackboi, context),
		}))
	)));
}
