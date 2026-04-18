import { existsSync } from "node:fs";
import { findGitRoot, listGitWorktrees, readGitContext } from "../git";
import { boardPath } from "../paths";
import { projectStatus } from "../sources";
import { canonicalProjectPath, countCards, projectName, resolveProjectStorage } from "../storage";
import type { Project, ProjectRegistry, ProjectSnapshotWithInternals, WorktreeContext } from "../types";
import type { WorktreeStore } from "./runtimeTypes";

type RegistryReader = () => ProjectRegistry;

/**
 * Stable cache key for one project's discovered worktree landscape.
 */
export function projectCacheKey(project: Project): string {
	return `${project.id}:${project.path}`;
}

/**
 * Discovers git worktrees for the active project and decorates them with
 * storage-root and card-count metadata used by the desktop shell.
 */
export function discoverWorktrees(options: {
	project: Project;
	readRegistry: RegistryReader;
	worktreeCache: Map<string, WorktreeStore[]>;
}): WorktreeStore[] {
	const { project, readRegistry, worktreeCache } = options;
	if (!existsSync(project.path)) return [];
	const cacheKey = projectCacheKey(project);
	const cached = worktreeCache.get(cacheKey);
	if (cached) return cached;

	const current = readRegistry();
	const repoRoot = findGitRoot(project.path);
	const discovered = repoRoot
		? listGitWorktrees(repoRoot)
		: [{ path: project.path, branch: null, isPrimary: true }];
	const worktrees = discovered.length > 0 ? discovered : [{ path: project.path, branch: null, isPrimary: true }];

	const nextWorktrees = worktrees.map((entry) => {
		const worktreePath = canonicalProjectPath(entry.path);
		const worktreeProject: Project = {
			id: project.id,
			name: project.name,
			path: worktreePath,
			storagePath: undefined,
		};
		const resolved = resolveProjectStorage(worktreeProject, current, false);
		const status = projectStatus(worktreeProject, current);
		const cardCount = resolved && existsSync(boardPath(resolved.rootPath))
			? countCards(resolved.rootPath)
			: 0;
		return {
			id: worktreePath,
			name: projectName(worktreePath),
			path: worktreePath,
			branch: entry.branch,
			isPrimary: entry.isPrimary,
			storagePath: resolved?.storagePath ?? null,
			storageRoot: resolved?.rootPath ?? null,
			status,
			cardCount,
			colorKey: worktreePath,
			project: worktreeProject,
			git: readGitContext(worktreePath),
		};
	});

	worktreeCache.set(cacheKey, nextWorktrees);
	return nextWorktrees;
}

/**
 * Picks the worktree that should drive the current desktop snapshot.
 */
export function pickSelectedWorktree(
	worktrees: WorktreeStore[],
	selectedWorktreeId: string | null | undefined,
): WorktreeStore | null {
	if (worktrees.length === 0) return null;
	const selected = selectedWorktreeId
		? worktrees.find((worktree) => worktree.id === selectedWorktreeId) ?? null
		: null;
	return selected ?? worktrees.find((worktree) => worktree.isPrimary) ?? worktrees[0] ?? null;
}

/**
 * Promotes a discovered worktree into a ready store by creating storage files
 * on demand when a workflow writes into that worktree.
 */
export function createSelectedWorktreeStore(options: {
	project: Project;
	worktree: WorktreeStore;
	readSnapshotForPath(project: Project, projectPath: string, create: boolean): ProjectSnapshotWithInternals | null;
}): WorktreeStore {
	const snapshot = options.readSnapshotForPath(options.project, options.worktree.path, true);
	if (!snapshot) return options.worktree;
	return {
		...options.worktree,
		storagePath: snapshot.project.storagePath ?? null,
		storageRoot: snapshot.storageRoot,
		status: "ready",
		cardCount: snapshot.cards.length,
	};
}

/**
 * Removes runtime-only decoration before exposing worktrees to UI clients.
 */
export function stripProjectFromWorktree(worktree: WorktreeStore): WorktreeContext {
	const { project: _project, git: _git, ...publicWorktree } = worktree;
	return publicWorktree;
}
