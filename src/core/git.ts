import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { GitChange, GitChanges, GitCommitResult, GitContext, GitIdentity, WorkScope } from "./types";

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

function execGit(projectPath: string, args: string[]): string {
	return execFileSync("git", ["-C", projectPath, ...args], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function parsePorcelainLine(line: string): GitChange | null {
	if (!line.trim()) return null;
	const pathStart = line.startsWith("??") ? 3 : 3;
	const rawPath = line.slice(pathStart).trim();
	const separatorIndex = rawPath.indexOf(" -> ");
	return {
		path: separatorIndex >= 0 ? rawPath.slice(separatorIndex + 4) : rawPath,
		indexStatus: line[0] ?? " ",
		worktreeStatus: line[1] ?? " ",
	};
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

/**
 * Lists porcelain git changes for the repository, optionally restricted to
 * caller-provided paths that should be shown or committed.
 */
export function listGitChanges(repoRoot: string, paths: string[] = []): GitChanges {
	const args = ["status", "--porcelain", "--", ...paths];
	const output = execGit(repoRoot, args);
	return {
		repoRoot,
		defaultPaths: [...paths],
		changes: output.split("\n").map(parsePorcelainLine).filter((change): change is GitChange => change != null),
	};
}

/**
 * Commits a narrow set of repository paths. The `--only` commit mode keeps
 * unrelated staged or unstaged user work out of the commit by default.
 */
export function commitGitChanges(repoRoot: string, message: string, paths: string[]): GitCommitResult {
	const cleanedMessage = message.trim();
	if (!cleanedMessage) throw new Error("Commit message is required");
	const cleanedPaths = paths.map((entry) => entry.trim()).filter(Boolean);
	if (cleanedPaths.length === 0) throw new Error("At least one commit path is required");

	const changes = listGitChanges(repoRoot, cleanedPaths);
	if (changes.changes.length === 0) throw new Error("No changes found in the selected paths");

	execGit(repoRoot, ["add", "--", ...cleanedPaths]);
	execGit(repoRoot, ["commit", "--only", "-m", cleanedMessage, "--", ...cleanedPaths]);
	const commit = execGit(repoRoot, ["rev-parse", "--short", "HEAD"]);
	return { ok: true, commit, message: cleanedMessage, paths: cleanedPaths };
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
