import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { GitContext, WorkScope } from "./types";

export function globalScope(): WorkScope {
	return { kind: "project", ref: "global" };
}

export function normalizeScope(scope: WorkScope): WorkScope {
	if (scope.kind === "branch" && scope.ref.trim()) return scope;
	return globalScope();
}

export function scopeForGitContext(git: GitContext): WorkScope {
	return git.branch ? { kind: "branch", ref: git.branch } : globalScope();
}

/**
 * Walks upward from a project path until a `.git` entry is found.
 *
 * This deliberately avoids calling git for the root lookup so non-git folders
 * stay cheap and predictable.
 */
export function findGitRoot(startPath: string): string | null {
	let current = startPath;
	for (let index = 0; index < 64; index += 1) {
		if (existsSync(path.join(current, ".git"))) return current;
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
	return null;
}

export function readGitContext(projectPath: string): GitContext {
	const root = findGitRoot(projectPath);
	if (!root) {
		return { isGitRepo: false, root: null, branch: null, detached: false, dirty: null };
	}

	let branch: string | null = null;
	try {
		const head = readFileSync(path.join(root, ".git", "HEAD"), "utf8").trim();
		branch = head.startsWith("ref: refs/heads/") ? head.slice("ref: refs/heads/".length) : null;
	} catch {
		branch = null;
	}

	let dirty: boolean | null = null;
	try {
		dirty = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).length > 0;
	} catch {
		dirty = null;
	}

	return { isGitRepo: true, root, branch, detached: branch == null, dirty };
}

export function listGitWorktreePaths(repoRoot: string): string[] {
	try {
		const stdout = execFileSync("git", ["-C", repoRoot, "worktree", "list", "--porcelain"], {
			encoding: "utf8",
		});
		return stdout
			.split("\n")
			.filter((line) => line.startsWith("worktree "))
			.map((line) => line.slice("worktree ".length).trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}
