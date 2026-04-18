import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CardPatch, NodeFsTrackboiActions } from "../../core";
import { cardIdSchema, columnSchema, getCard, projectIdSchema, scopeSchema, toolResult, withProject } from "./helpers";

/**
 * Registers MCP tools for card reads and card mutations.
 */
export function registerCardTools(server: McpServer, trackboi: NodeFsTrackboiActions): void {
	server.registerTool("list_cards", {
		title: "List cards",
		description: "List cards for a project. Optionally filter by column or top-level cards only.",
		inputSchema: {
			projectId: projectIdSchema,
			column: z.string().optional(),
			parentId: z.string().nullable().optional().describe("Use null for top-level cards only."),
		},
	}, ({ projectId, column, parentId }) => toolResult(() => withProject(trackboi, projectId, async () => {
		const snapshot = await trackboi.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		return snapshot.cards.filter((card) => (
			(column == null || card.column === column) &&
			(parentId === undefined || card.parentId === parentId)
		));
	})));

	server.registerTool("get_card", {
		title: "Get card",
		description: "Get one card by id.",
		inputSchema: {
			projectId: projectIdSchema,
			cardId: cardIdSchema,
		},
	}, ({ projectId, cardId }) => toolResult(() => withProject(trackboi, projectId, () => getCard(trackboi, cardId))));

	server.registerTool("create_card", {
		title: "Create card",
		description: "Create a card in a project.",
		inputSchema: {
			projectId: projectIdSchema,
			title: z.string().min(1),
			description: z.string().optional(),
			parentId: z.string().nullable().optional(),
			column: columnSchema,
			scope: scopeSchema.optional(),
			trackId: z.string().nullable().optional(),
			targetWorktreeId: z.string().optional().describe("Optional worktree id to store the new card in."),
		},
	}, ({ projectId, title, description, parentId, column, scope, trackId, targetWorktreeId }) => toolResult(() => (
		withProject(trackboi, projectId, () => trackboi.createCard({
			title,
			description,
			parentId,
			column,
			scope,
			trackId,
			targetWorktreeId,
		}))
	)));

	server.registerTool("update_card", {
		title: "Update card",
		description: "Patch card fields. Omitted fields are left unchanged.",
		inputSchema: {
			projectId: projectIdSchema,
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
	}, ({ projectId, cardId, title, description, parentId, column, scope, trackId, labels, assignee }) => (
		toolResult(() => withProject(trackboi, projectId, async () => {
			const patch: CardPatch = {};
			if (title !== undefined) patch.title = title;
			if (description !== undefined) patch.description = description;
			if (parentId !== undefined) patch.parentId = parentId;
			if (column !== undefined) patch.column = column;
			if (scope !== undefined) patch.scope = scope;
			if (trackId !== undefined) patch.trackId = trackId;
			if (labels !== undefined) patch.labels = labels;
			if (assignee !== undefined) patch.assignee = assignee;
			return trackboi.updateCard(cardId, patch);
		}))
	));

	server.registerTool("move_card", {
		title: "Move card",
		description: "Move a card to a column and optionally position it before another card.",
		inputSchema: {
			projectId: projectIdSchema,
			cardId: cardIdSchema,
			toColumn: columnSchema,
			beforeCardId: z.string().nullable().optional(),
		},
	}, ({ projectId, cardId, toColumn, beforeCardId }) => toolResult(() => (
		withProject(trackboi, projectId, () => trackboi.moveCard(cardId, toColumn, beforeCardId ?? null))
	)));

	server.registerTool("delete_card", {
		title: "Delete card",
		description: "Delete one card file from Trackboi storage.",
		inputSchema: {
			projectId: projectIdSchema,
			cardId: cardIdSchema,
		},
	}, ({ projectId, cardId }) => toolResult(() => (
		withProject(trackboi, projectId, () => trackboi.deleteCard(cardId))
	)));
}
