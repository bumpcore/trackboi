import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import type { AgentContext, Card, NodeFsTrackboiActions, ProjectEntry, ProjectSnapshot, ProjectView, WorktreeContext } from "../../core";

export type ToolHandler = () => unknown | Promise<unknown>;
export type McpCard = Omit<Card, "scope" | "variants"> & {
	variants?: Array<Omit<NonNullable<Card["variants"]>[number], "scope">>;
};

export const projectPathSchema = z.string().optional().describe("Project path. Defaults to the agent's active project.");
export const boardIdSchema = z.string().optional().describe("Board id. Defaults to the agent's active board for that project.");
export const columnSchema = z.string().min(1).describe("Board column id.");
export const cardIdSchema = z.string().min(1).describe("Card id.");

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
	projectPath?: string,
): Promise<ProjectSnapshot> {
	const snapshot = await withProject(trackboi, context, projectPath, (actions) => actions.getActiveProject());
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
	projectPath?: string,
): Promise<McpCard> {
	const card = (await requireSnapshot(trackboi, context, projectPath)).cards.find((candidate) => candidate.id === cardId);
	if (!card) throw new Error(`Unknown card: ${cardId}`);
	return toMcpCard(card);
}

/**
 * Keeps legacy card scope compatibility internal to core storage/runtime data.
 */
export function toMcpCard(card: Card): McpCard {
	const { scope: _scope, variants, ...rest } = card;
	return {
		...rest,
		...(variants
			? {
				variants: variants.map((variant) => {
					const { scope: _variantScope, ...variantRest } = variant;
					return variantRest;
				}),
			}
			: {}),
	};
}

/**
 * Tracks the MCP server's own project context so agents do not inherit the
 * desktop UI's selected project.
 */
export type McpProjectContext = {
	currentProjectPath(): Promise<string | null>;
	setCurrentProjectPath(projectPath: string): Promise<ProjectEntry>;
	currentWorktreeId(projectPath?: string): Promise<string | null>;
	setCurrentWorktreeId(projectPath: string, worktreeId: string | null): Promise<void>;
	currentBoardId(projectPath?: string): Promise<string | null>;
	setCurrentBoardId(projectPath: string, boardId: string | null): Promise<void>;
	currentAgentId(): Promise<string | null>;
	setCurrentAgentId(agentId: string | null): Promise<void>;
	listView(): Promise<ProjectView & {
		cwd: string;
		agentActiveProjectPath: string | null;
		desktopActiveProjectPath: string | null;
		agentActiveWorktreeId: string | null;
		desktopActiveWorktreeId: string | null;
		agentActiveBoardId: string | null;
		desktopActiveBoardId: string | null;
	}>;
};

export async function createMcpProjectContext(
	trackboi: NodeFsTrackboiActions,
	cwd: string = process.cwd(),
): Promise<McpProjectContext> {
	let activeAgentId: string | null = trackboi.readRegistry().appSettings.agents[0]?.id ?? null;

	async function currentProjectPath(): Promise<string | null> {
		const agentContext = await currentContext();
		return agentContext.projectPath;
	}

	async function currentContext(): Promise<AgentContext> {
		const settings = await trackboi.readAppSettings();
		const agentId = await currentAgentId();
		const key = agentContextKey(agentId);
		const persisted = settings.agentContexts.find((entry) => entry.agentId === key);
		if (persisted) {
			return persisted;
		}

		const initial = await resolveInitialAgentContext(trackboi, cwd);
		const created: AgentContext = {
			agentId: key,
			projectPath: initial.projectPath,
			worktreeId: initial.worktreeId,
			boardId: initial.boardId,
		};
		await writeAgentContext(trackboi, created);
		return created;
	}

	async function updateContext(updater: (context: AgentContext) => AgentContext): Promise<AgentContext> {
		const next = updater(await currentContext());
		await writeAgentContext(trackboi, next);
		return next;
	}

	async function currentAgentId(): Promise<string | null> {
		const agents = trackboi.readRegistry().appSettings.agents;
		if (activeAgentId && agents.some((agent) => agent.id === activeAgentId)) return activeAgentId;
		activeAgentId = agents[0]?.id ?? null;
		return activeAgentId;
	}

	return {
		async currentProjectPath() {
			return currentProjectPath();
		},
		async setCurrentProjectPath(projectPath: string) {
			const view = await trackboi.listView();
			const entry = listEntries(view).find((candidate) => candidate.projectPath === projectPath);
			if (!entry) throw new Error(`Unknown project: ${projectPath}`);
			const initial = await resolveProjectWorktreeAndBoard(trackboi, entry.projectPath, cwd);
			await updateContext((context) => ({
				...context,
				projectPath: entry.projectPath,
				worktreeId: initial.worktreeId,
				boardId: initial.boardId,
			}));
			return entry;
		},
		async currentWorktreeId(projectPath) {
			const context = await currentContext();
			if (projectPath && context.projectPath !== projectPath) return null;
			return context.worktreeId;
		},
		async setCurrentWorktreeId(projectPath, worktreeId) {
			await updateContext((context) => {
				if (context.projectPath !== projectPath) {
					return {
						...context,
						projectPath,
						worktreeId,
						boardId: context.boardId,
					};
				}
				return {
					...context,
					worktreeId,
				};
			});
		},
		async currentBoardId(projectPath) {
			const context = await currentContext();
			const resolvedProjectPath = projectPath ?? context.projectPath;
			if (!resolvedProjectPath || context.projectPath !== resolvedProjectPath) return null;
			return context.boardId;
		},
		async setCurrentBoardId(projectPath, boardId) {
			await updateContext((context) => ({
				...context,
				projectPath,
				boardId,
			}));
		},
		async currentAgentId() {
			return currentAgentId();
		},
		async setCurrentAgentId(agentId) {
			activeAgentId = agentId;
			await currentContext();
		},
		async listView() {
			const view = await trackboi.listView();
			const context = await currentContext();
			return {
				...view,
				cwd,
				agentActiveProjectPath: context.projectPath,
				desktopActiveProjectPath: view.activeProjectPath,
				agentActiveWorktreeId: context.worktreeId,
				desktopActiveWorktreeId: trackboi.readRegistry().selectedWorktreeId,
				agentActiveBoardId: context.boardId,
				desktopActiveBoardId: trackboi.readRegistry().selectedBoardId,
				activeProjectPath: context.projectPath ?? view.activeProjectPath,
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
	projectPath: string | undefined,
	action: (actions: NodeFsTrackboiActions) => T | Promise<T>,
): Promise<T> {
	const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
	if (!resolvedProjectPath) return action(trackboi);
	const worktreeId = await context.currentWorktreeId(resolvedProjectPath);
	const boardId = await context.currentBoardId(resolvedProjectPath);
	return trackboi.withScopedContext({
		projectPath: resolvedProjectPath,
		worktreeId: worktreeId ?? resolvedProjectPath,
		boardId,
	}, async (scoped) => action(scoped));
}

export function pickAgentProjectPath(view: ProjectView, cwd: string): string | null {
	const entries = listEntries(view);
	const normalizedCwd = normalizePath(cwd);
	const matchingEntry = entries
		.filter((entry) => pathContains(normalizedCwd, normalizePath(entry.path)))
		.sort((left, right) => right.path.length - left.path.length)[0];
	return matchingEntry?.projectPath ?? view.activeProjectPath;
}

function listEntries(view: ProjectView): ProjectEntry[] {
	return view.sources.flatMap((source) => source.entries);
}

async function resolveInitialAgentContext(
	trackboi: NodeFsTrackboiActions,
	cwd: string,
): Promise<{ projectPath: string | null; worktreeId: string | null; boardId: string | null }> {
	const view = await trackboi.listView();
	const normalizedCwd = normalizePath(cwd);
	const directProjectPath = pickAgentProjectPath(view, cwd);
	const visibleProjects = listEntries(view);
	const containingProject = directProjectPath
		? visibleProjects.find((entry) => entry.projectPath === directProjectPath) ?? null
		: null;

	if (containingProject) {
		const worktreeId = await resolveWorktreeForProject(trackboi, containingProject.projectPath, normalizedCwd);
		const boardId = await resolveBoardForProject(trackboi, containingProject.projectPath, worktreeId);
		return { projectPath: containingProject.projectPath, worktreeId, boardId };
	}

	for (const entry of visibleProjects) {
		const worktreeId = await resolveWorktreeForProject(trackboi, entry.projectPath, normalizedCwd);
		if (!worktreeId) continue;
		const boardId = await resolveBoardForProject(trackboi, entry.projectPath, worktreeId);
		return { projectPath: entry.projectPath, worktreeId, boardId };
	}

	const projectPath = view.activeProjectPath;
	if (!projectPath) return { projectPath: null, worktreeId: null, boardId: null };
	const boardId = trackboi.readRegistry().selectedBoardId;
	return { projectPath, worktreeId: trackboi.readRegistry().selectedWorktreeId ?? projectPath, boardId };
}

async function resolveProjectWorktreeAndBoard(
	trackboi: NodeFsTrackboiActions,
	projectPath: string,
	cwd: string,
): Promise<{ worktreeId: string | null; boardId: string | null }> {
	const normalizedCwd = normalizePath(cwd);
	const worktreeId = await resolveWorktreeForProject(trackboi, projectPath, normalizedCwd);
	const boardId = await resolveBoardForProject(trackboi, projectPath, worktreeId);
	return { worktreeId, boardId };
}

async function resolveWorktreeForProject(
	trackboi: NodeFsTrackboiActions,
	projectPath: string,
	normalizedCwd: string,
): Promise<string | null> {
	const worktrees = await listProjectWorktrees(trackboi, projectPath);
	const match = worktrees
		.filter((worktree) => pathContains(normalizedCwd, normalizePath(worktree.path)))
		.sort((left, right) => right.path.length - left.path.length)[0];
	return match?.id ?? worktrees.find((worktree) => worktree.isPrimary)?.id ?? worktrees[0]?.id ?? projectPath;
}

async function resolveBoardForProject(
	trackboi: NodeFsTrackboiActions,
	projectPath: string,
	worktreeId: string | null,
): Promise<string | null> {
	return trackboi.withScopedContext({
		projectPath,
		worktreeId: worktreeId ?? projectPath,
		boardId: null,
	}, async (scoped) => {
		const snapshot = await scoped.getActiveProject();
		return snapshot?.board.id ?? null;
	});
}

async function listProjectWorktrees(trackboi: NodeFsTrackboiActions, projectPath: string): Promise<WorktreeContext[]> {
	return trackboi.withScopedContext({
		projectPath,
		worktreeId: projectPath,
		boardId: null,
	}, async (scoped) => {
		const state = await scoped.readDesktopState();
		return state.worktrees;
	});
}

function agentContextKey(agentId: string | null): string {
	return agentId ?? "__default__";
}

async function writeAgentContext(trackboi: NodeFsTrackboiActions, nextContext: AgentContext): Promise<void> {
	const settings = await trackboi.readAppSettings();
	const agentContexts = settings.agentContexts.filter((entry) => entry.agentId !== nextContext.agentId);
	await trackboi.updateAppSettings({
		...settings,
		agentContexts: [...agentContexts, nextContext],
	});
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
