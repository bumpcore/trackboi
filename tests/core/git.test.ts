import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { commitGitChanges, listGitChanges } from "../../src/core/git";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

function git(repo: string, args: string[]): string {
	return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

function createRepo(): string {
	const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-git-"));
	roots.push(root);
	git(root, ["init", "-b", "master"]);
	git(root, ["config", "user.name", "Trackboi Test"]);
	git(root, ["config", "user.email", "trackboi@example.test"]);
	writeFileSync(path.join(root, "README.md"), "initial\n");
	git(root, ["add", "README.md"]);
	git(root, ["commit", "-m", "Initial"]);
	return root;
}

describe("git helpers", () => {
	test("lists and commits only selected paths", () => {
		const repo = createRepo();
		mkdirSync(path.join(repo, ".trackboi/cards/card-1"), { recursive: true });
		writeFileSync(path.join(repo, ".trackboi/cards/card-1/index.md"), "# Card\n");
		writeFileSync(path.join(repo, "README.md"), "user work\n");

		const changes = listGitChanges(repo, [".trackboi"]);
		expect(changes.changes.map((change) => change.path)).toEqual([".trackboi/"]);

		const result = commitGitChanges(repo, "Update trackboi state", [".trackboi"]);
		expect(result.ok).toBe(true);
		expect(result.paths).toEqual([".trackboi"]);
		expect(git(repo, ["status", "--porcelain", "--", ".trackboi"])).toBe("");
		expect(git(repo, ["status", "--porcelain", "--", "README.md"])).toContain("README.md");
	});
});
