import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import type { Card, NodeFsTrackboiActions, ProjectEntry, ProjectSnapshot, ProjectView } from "../../core";

export type ToolHandler = () => unknown | Promise<unknown>;

export const projectIdSchema = z.string().optional().describe("Project id. Defaults to the agent's active project.");
export const boardIdSchema = z.string().optional().describe("Board id. Defaults to the agent's active board for that project.");
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
export async function requireSnapshot(
	trackboi: NodeFsTrackboiActions,
	context: McpProjectContext,
	projectId?: string,
): Promise<ProjectSnapshot> {
	const snapshot = await withProject(trackboi, context, projectId, () => trackboi.getActiveProject());
	if (!snapshot) throw new Error("Choose a project first");
	return snapshot;
}

/**
 * Loads one card from the active snapshot. MCP tools use this helper so every
 * “card not found” path produces the same error message.
 */
export async function getCard(
	trackboi: NodeFsTrackboiActions,
	context: McpProjectContext,
	cardId: string,
	projectId?: string,
): Promise<Card> {
	const card = (await requireSnapshot(trackboi, context, projectId)).cards.find((candidate) => candidate.id === cardId);
	if (!card) throw new Error(`Unknown card: ${cardId}`);
	return card;
}

/**
 * Tracks the MCP server's own project context so agents do not inherit the
 * desktop UI's selected project.
 */
export type McpProjectContext = {
	currentProjectId(): Promise<string | null>;
	setCurrentProjectId(projectId: string): Promise<ProjectEntry>;
	currentBoardId(projectId?: string): Promise<string | null>;
	setCurrentBoardId(projectId: string, boardId: string | null): Promise<void>;
	currentAgentId(): Promise<string | null>;
	setCurrentAgentId(agentId: string | null): Promise<void>;
	listView(): Promise<ProjectView & {
		agentActiveProjectId: string | null;
		desktopActiveProjectId: string | null;
	}>;
};

export async function createMcpProjectContext(
	trackboi: NodeFsTrackboiActions,
	cwd: string = process.cwd(),
): Promise<McpProjectContext> {
	let activeProjectId = pickAgentProjectId(await trackboi.listView(), cwd);
	const activeBoardIdsByProject = new Map<string, string | null>();
	let activeAgentId: string | null = trackboi.readRegistry().appSettings.agents[0]?.id ?? null;

	async function currentProjectId(): Promise<string | null> {
		const view = await trackboi.listView();
		const projectId = activeProjectId && listEntries(view).some((entry) => entry.projectId === activeProjectId)
			? activeProjectId
			: pickAgentProjectId(view, cwd);
		activeProjectId = projectId;
		return projectId;
	}

	return {
		async currentProjectId() {
			return currentProjectId();
		},
		async setCurrentProjectId(projectId: string) {
			const view = await trackboi.listView();
			const entry = listEntries(view).find((candidate) => candidate.projectId === projectId);
			if (!entry) throw new Error(`Unknown project: ${projectId}`);
			activeProjectId = entry.projectId;
			return entry;
		},
		async currentBoardId(projectId) {
			const resolvedProjectId = projectId ?? await currentProjectId();
			if (!resolvedProjectId) return null;
			return activeBoardIdsByProject.get(resolvedProjectId) ?? null;
		},
		async setCurrentBoardId(projectId, boardId) {
			activeBoardIdsByProject.set(projectId, boardId);
		},
		async currentAgentId() {
			const agents = trackboi.readRegistry().appSettings.agents;
			if (activeAgentId && agents.some((agent) => agent.id === activeAgentId)) return activeAgentId;
			activeAgentId = agents[0]?.id ?? null;
			return activeAgentId;
		},
		async setCurrentAgentId(agentId) {
			activeAgentId = agentId;
		},
		async listView() {
			const view = await trackboi.listView();
			const agentActiveProjectId = await currentProjectId();
			return {
				...view,
				agentActiveProjectId,
				desktopActiveProjectId: view.activeProjectId,
				activeProjectId: agentActiveProjectId ?? view.activeProjectId,
			};
		},
	};
}

export async function requireAgentId(
	trackboi: NodeFsTrackboiActions,
	context: McpProjectContext,
): Promise<string> {
	const agentId = await context.currentAgentId();
	if (!agentId) {
		const agents = trackboi.readRegistry().appSettings.agents;
		if (agents.length === 0) throw new Error("Register an agent first");
		throw new Error("Set an active agent before running MCP mutations");
	}
	return agentId;
}

/**
 * Temporarily switches core into the agent-selected project for a tool call,
 * then restores the desktop-facing registry selection afterwards.
 */
export async function withProject<T>(
	trackboi: NodeFsTrackboiActions,
	context: McpProjectContext,
	projectId: string | undefined,
	action: () => T | Promise<T>,
): Promise<T> {
	const resolvedProjectId = projectId ?? await context.currentProjectId();
	if (!resolvedProjectId) return action();
	const registry = trackboi.readRegistry();
	const previousActiveProjectId = registry.activeProjectId;
	const previousSelectedWorktreeId = registry.selectedWorktreeId;
	const previousSelectedBoardId = registry.selectedBoardId;
	await trackboi.switchProject(resolvedProjectId);
	const nextBoardId = await context.currentBoardId(resolvedProjectId);
	if (nextBoardId) await trackboi.setActiveBoard(nextBoardId);
	try {
		return await action();
	} finally {
		const nextRegistry = trackboi.readRegistry();
		nextRegistry.activeProjectId = previousActiveProjectId;
		nextRegistry.selectedWorktreeId = previousSelectedWorktreeId;
		nextRegistry.selectedBoardId = previousSelectedBoardId;
		trackboi.writeRegistry(nextRegistry);
	}
}

export function pickAgentProjectId(view: ProjectView, cwd: string): string | null {
	const entries = listEntries(view);
	const normalizedCwd = normalizePath(cwd);
	const matchingEntry = entries
		.filter((entry) => pathContains(normalizedCwd, normalizePath(entry.path)))
		.sort((left, right) => right.path.length - left.path.length)[0];
	return matchingEntry?.projectId ?? view.activeProjectId;
}

function listEntries(view: ProjectView): ProjectEntry[] {
	return view.sources.flatMap((source) => source.entries);
}

function normalizePath(value: string): string {
	return path.resolve(value);
}

function pathContains(subjectPath: string, candidatePath: string): boolean {
	return subjectPath === candidatePath || subjectPath.startsWith(`${candidatePath}${path.sep}`);
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
