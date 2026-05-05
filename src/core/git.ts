import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { GitContext, GitIdentity, WorkScope } from "./types";

export type GitWorktree = {
	path: string;
	branch: string | null;
	isPrimary: boolean;
};

export function globalScope(): WorkScope {
	return { kind: "project", ref: "global" };
}

export function normalizeScope(scope: WorkScope): WorkScope {
	if (scope.kind === "track" && scope.ref.trim()) return scope;
	return globalScope();
}

export function scopeForGitContext(git: GitContext): WorkScope {
	return git.branch ? { kind: "track", ref: git.branch } : globalScope();
}

function runGit(projectPath: string, args: string[]): string | null {
	try {
		return execFileSync("git", ["-C", projectPath, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

/**
 * Finds the working-tree root for regular clones and git worktrees.
 *
 * Worktrees keep `.git` as a file, so `git rev-parse` is the authoritative
 * path. The manual walk is only a cheap fallback for environments without git.
 */
export function findGitRoot(startPath: string): string | null {
	const gitRoot = runGit(startPath, ["rev-parse", "--show-toplevel"]);
	if (gitRoot) return gitRoot;

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
		return { isGitRepo: false, root: null, branch: null, detached: false, dirty: null, identity: null };
	}

	const branchOutput = runGit(root, ["branch", "--show-current"]);
	const branch = branchOutput && branchOutput.length > 0 ? branchOutput : null;

	const statusOutput = runGit(root, ["status", "--porcelain"]);
	const dirty = statusOutput == null ? null : statusOutput.length > 0;

	return { isGitRepo: true, root, branch, detached: branch == null, dirty, identity: readGitIdentity(root) };
}

export function listGitWorktrees(repoRoot: string): GitWorktree[] {
	try {
		const stdout = execFileSync("git", ["-C", repoRoot, "worktree", "list", "--porcelain"], {
			encoding: "utf8",
		});
		const worktrees: GitWorktree[] = [];
		let currentPath: string | null = null;
		let currentBranch: string | null = null;
		let index = 0;
		for (const line of stdout.split("\n")) {
			if (line.startsWith("worktree ")) {
				if (currentPath) {
					worktrees.push({
						path: currentPath,
						branch: currentBranch,
						isPrimary: index === 0,
					});
					index += 1;
				}
				currentPath = line.slice("worktree ".length).trim();
				currentBranch = null;
				continue;
			}
			if (line.startsWith("branch ")) {
				const fullRef = line.slice("branch ".length).trim();
				currentBranch = fullRef.replace(/^refs\/heads\//, "") || null;
			}
		}
		if (currentPath) {
			worktrees.push({
				path: currentPath,
				branch: currentBranch,
				isPrimary: index === 0,
			});
		}
		return worktrees;
	} catch {
		return [];
	}
}

export function readGitIdentity(projectPath: string): GitIdentity | null {
	const root = findGitRoot(projectPath);
	if (!root) return null;

	const name = runGit(root, ["config", "user.name"]) ?? "";
	const email = runGit(root, ["config", "user.email"]) ?? "";
	if (!name.trim() && !email.trim()) return null;
	return {
		name: name.trim(),
		email: email.trim(),
	};
}
