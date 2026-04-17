import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import type { Card, CardPatch, ProjectSnapshot, TrackboiRuntime } from "../core";

type ToolHandler = () => unknown | Promise<unknown>;

const projectIdSchema = z.string().optional().describe("Project id. Defaults to Trackboi's active project.");
const columnSchema = z.string().min(1).describe("Board column id.");
const cardIdSchema = z.string().min(1).describe("Card id.");
const scopeSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("project"),
		ref: z.literal("global"),
	}),
	z.object({
		kind: z.literal("branch"),
		ref: z.string().min(1),
	}),
]);

/**
 * Starts Trackboi's stdio MCP server.
 *
 * The server intentionally talks only to `TrackboiRuntime`; it never reaches
 * into Electron or Vue. That keeps desktop, CLI, and agents on one write path.
 */
export async function runMcpServer(runtime: TrackboiRuntime): Promise<void> {
	const server = new McpServer({
		name: "trackboi",
		version: "0.1.0",
	});

	registerProjectTools(server, runtime);
	registerBoardTools(server, runtime);
	registerCardTools(server, runtime);

	const transport = new StdioServerTransport();
	const closed = new Promise<void>((resolve) => {
		transport.onclose = resolve;
	});
	await server.connect(transport);
	console.error("Trackboi MCP server running on stdio");
	await closed;
}

function registerProjectTools(server: McpServer, runtime: TrackboiRuntime): void {
	server.registerTool("list_projects", {
		title: "List projects",
		description: "List projects Trackboi can see, grouped by source.",
	}, () => toolResult(() => runtime.listView()));

	server.registerTool("get_active_project", {
		title: "Get active project",
		description: "Return the active project snapshot, including board, git context, and cards.",
	}, () => toolResult(() => runtime.activeSnapshot()));

	server.registerTool("switch_project", {
		title: "Switch project",
		description: "Switch Trackboi's active project.",
		inputSchema: {
			projectId: z.string().min(1),
		},
	}, ({ projectId }) => toolResult(() => runtime.switchProject(projectId)));
}

function registerBoardTools(server: McpServer, runtime: TrackboiRuntime): void {
	server.registerTool("list_columns", {
		title: "List columns",
		description: "List board columns for a project.",
		inputSchema: {
			projectId: projectIdSchema,
		},
	}, ({ projectId }) => toolResult(() => withProject(runtime, projectId, () => {
		const snapshot = requireSnapshot(runtime);
		return snapshot.board.columns;
	})));
}

function registerCardTools(server: McpServer, runtime: TrackboiRuntime): void {
	server.registerTool("list_cards", {
		title: "List cards",
		description: "List cards for a project. Optionally filter by column or top-level cards only.",
		inputSchema: {
			projectId: projectIdSchema,
			column: z.string().optional(),
			parentId: z.string().nullable().optional().describe("Use null for top-level cards only."),
		},
	}, ({ projectId, column, parentId }) => toolResult(() => withProject(runtime, projectId, () => {
		const snapshot = requireSnapshot(runtime);
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
	}, ({ projectId, cardId }) => toolResult(() => withProject(runtime, projectId, () => getCard(runtime, cardId))));

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
		},
	}, ({ projectId, title, description, parentId, column, scope }) => toolResult(() => (
		withProject(runtime, projectId, () => runtime.createCard({
			title,
			description,
			parentId,
			column,
			scope,
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
			labels: z.array(z.string()).optional(),
			assignee: z.string().nullable().optional(),
		},
	}, ({ projectId, cardId, title, description, parentId, column, scope, labels, assignee }) => (
		toolResult(() => withProject(runtime, projectId, () => {
			const patch: CardPatch = {};
			if (title !== undefined) patch.title = title;
			if (description !== undefined) patch.description = description;
			if (parentId !== undefined) patch.parentId = parentId;
			if (column !== undefined) patch.column = column;
			if (scope !== undefined) patch.scope = scope;
			if (labels !== undefined) patch.labels = labels;
			if (assignee !== undefined) patch.assignee = assignee;
			return runtime.updateCard(cardId, patch);
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
		withProject(runtime, projectId, () => runtime.moveCard({
			cardId,
			toColumn,
			beforeCardId,
		}))
	)));

	server.registerTool("delete_card", {
		title: "Delete card",
		description: "Delete one card file from Trackboi storage.",
		inputSchema: {
			projectId: projectIdSchema,
			cardId: cardIdSchema,
		},
	}, ({ projectId, cardId }) => toolResult(() => (
		withProject(runtime, projectId, () => runtime.deleteCard(cardId))
	)));
}

function toolResult(handler: ToolHandler): Promise<CallToolResult> {
	return Promise.resolve()
		.then(handler)
		.then((value) => {
			if (isCallToolResult(value)) return value;
			return jsonResult(value);
		})
		.catch((error: unknown) => ({
			isError: true,
			content: [{
				type: "text",
				text: error instanceof Error ? error.message : String(error),
			}],
		}));
}

function jsonResult(value: unknown): CallToolResult {
	return {
		content: [{
			type: "text",
			text: JSON.stringify(value, null, "\t"),
		}],
	};
}

function isCallToolResult(value: unknown): value is CallToolResult {
	return typeof value === "object" && value !== null && "content" in value;
}

function requireSnapshot(runtime: TrackboiRuntime): ProjectSnapshot {
	const snapshot = runtime.activeSnapshot();
	if (!snapshot) throw new Error("Choose a project first");
	return snapshot;
}

function getCard(runtime: TrackboiRuntime, cardId: string): Card {
	const card = requireSnapshot(runtime).cards.find((candidate) => candidate.id === cardId);
	if (!card) throw new Error(`Unknown card: ${cardId}`);
	return card;
}

function withProject<T>(runtime: TrackboiRuntime, projectId: string | undefined, action: () => T): T {
	if (!projectId) return action();
	const registry = runtime.readRegistry();
	const previousActiveProjectId = registry.activeProjectId;
	runtime.switchProject(projectId);
	try {
		return action();
	} finally {
		const nextRegistry = runtime.readRegistry();
		nextRegistry.activeProjectId = previousActiveProjectId;
		runtime.writeRegistry(nextRegistry);
	}
}
