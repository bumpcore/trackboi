import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import type { Card, NodeFsTrackboiActions, ProjectSnapshot } from "../../core";

export type ToolHandler = () => unknown | Promise<unknown>;

export const projectIdSchema = z.string().optional().describe("Project id. Defaults to Trackboi's active project.");
export const columnSchema = z.string().min(1).describe("Board column id.");
export const cardIdSchema = z.string().min(1).describe("Card id.");
export const scopeSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("project"),
		ref: z.literal("global"),
	}),
	z.object({
		kind: z.literal("track"),
		ref: z.string().min(1),
	}),
]);

/**
 * Wraps MCP tool handlers so successful values are serialized consistently and
 * thrown errors become MCP error payloads instead of uncaught rejections.
 */
export function toolResult(handler: ToolHandler): Promise<CallToolResult> {
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

/**
 * Resolves the active snapshot or fails with a user-facing message when no
 * project is active yet.
 */
export async function requireSnapshot(trackboi: NodeFsTrackboiActions): Promise<ProjectSnapshot> {
	const snapshot = await trackboi.getActiveProject();
	if (!snapshot) throw new Error("Choose a project first");
	return snapshot;
}

/**
 * Loads one card from the active snapshot. MCP tools use this helper so every
 * “card not found” path produces the same error message.
 */
export async function getCard(trackboi: NodeFsTrackboiActions, cardId: string): Promise<Card> {
	const card = (await requireSnapshot(trackboi)).cards.find((candidate) => candidate.id === cardId);
	if (!card) throw new Error(`Unknown card: ${cardId}`);
	return card;
}

/**
 * Temporarily switches Trackboi's active project for a tool call, then restores
 * the previous active project after the action finishes.
 */
export async function withProject<T>(
	trackboi: NodeFsTrackboiActions,
	projectId: string | undefined,
	action: () => T | Promise<T>,
): Promise<T> {
	if (!projectId) return action();
	const registry = trackboi.readRegistry();
	const previousActiveProjectId = registry.activeProjectId;
	await trackboi.switchProject(projectId);
	try {
		return await action();
	} finally {
		const nextRegistry = trackboi.readRegistry();
		nextRegistry.activeProjectId = previousActiveProjectId;
		trackboi.writeRegistry(nextRegistry);
	}
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

/**
 * Groups tool registration helpers under one small surface for the MCP
 * bootstrap file.
 */
export type RegisterToolGroup = (server: McpServer, trackboi: NodeFsTrackboiActions) => void;
