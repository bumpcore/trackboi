import { afterEach, describe, expect, test } from "bun:test";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRuntime } from "../../src/core/runtime";
import { writeJsonAtomic } from "../../src/core/json";
import type { Board, Card, ProjectMetadata } from "../../src/core/types";

const createdRoots: string[] = [];

afterEach(() => {
	for (const root of createdRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("runtime performance", () => {
	test("repeated desktop state reads stay fast on larger worktree-backed stores", () => {
		const fixture = createPerformanceFixture();
		fixture.seedStore(fixture.mainRepo, ".trackboi", 1200, "main");
		fixture.seedStore(fixture.checkoutWorktree, ".etc/trackboi", 1200, "checkout");
		fixture.seedStore(fixture.onboardingWorktree, ".etc/.trackboi", 1200, "onboarding");

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);

		const startedAt = performance.now();
		let visibleCards = 0;
		for (let index = 0; index < 20; index += 1) {
			visibleCards += runtime.readDesktopState().snapshot?.cards.length ?? 0;
		}
		const elapsed = performance.now() - startedAt;

		console.info(`runtime desktop-state benchmark: ${elapsed.toFixed(2)}ms total for 20 reads`);
		expect(visibleCards).toBeGreaterThan(0);
		expect(elapsed).toBeLessThan(180);
	});
});

function createPerformanceFixture() {
	const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-runtime-perf-"));
	createdRoots.push(root);

	const mainRepo = path.join(root, "repo");
	runGit(root, ["init", "--initial-branch=master", mainRepo]);
	writeFileSync(path.join(mainRepo, "README.md"), "# Runtime perf fixture\n");
	runGit(mainRepo, ["config", "user.name", "Trackboi Tests"]);
	runGit(mainRepo, ["config", "user.email", "tests@trackboi.local"]);
	runGit(mainRepo, ["add", "."]);
	runGit(mainRepo, ["commit", "-m", "Initial fixture"]);

	const onboardingWorktree = path.join(root, "onboarding");
	const checkoutWorktree = path.join(root, "checkout-mcp");
	runGit(mainRepo, ["worktree", "add", "-b", "feature/onboarding", onboardingWorktree]);
	runGit(mainRepo, ["worktree", "add", "-b", "spike/checkout-mcp", checkoutWorktree]);

	return {
		mainRepo,
		onboardingWorktree,
		checkoutWorktree,
		runtime: () => createRuntime({ configPath: path.join(root, "config.json"), legacyConfigPaths: [] }),
		seedStore(projectPath: string, storagePath: string, cardCount: number, prefix: string) {
			const storageRoot = path.join(projectPath, storagePath);
			const board: Board = {
				version: 1,
				name: `${prefix} board`,
				columns: [
					{ id: "todo", name: "To Do" },
					{ id: "doing", name: "Doing" },
					{ id: "done", name: "Done" },
				],
				customFields: [],
			};
			const metadata: ProjectMetadata = {
				version: 1,
				projectId: `${prefix}-project`,
				name: path.basename(projectPath),
				storagePath,
				createdAt: "2026-04-18T07:59:00.000Z",
				customFields: [],
			};

			writeJsonAtomic(path.join(storageRoot, "boards/default.json"), board);
			writeJsonAtomic(path.join(storageRoot, "project.json"), metadata);

			for (let index = 0; index < cardCount; index += 1) {
				const card: Card = {
					id: `${prefix}_card_${index}`,
					boardId: "default",
					title: `${prefix} card ${index}`,
					description: index % 4 === 0 ? "Investigate filesystem churn and keep reads cached." : "",
					parentId: null,
					scope: index % 3 === 0 ? { kind: "project", ref: "global" } : { kind: "track", ref: `${prefix}/branch-${index % 12}` },
					column: index % 3 === 0 ? "todo" : index % 3 === 1 ? "doing" : "done",
					rank: String(index).padStart(6, "0"),
					labels: [],
					assignee: null,
					fieldValues: {},
					comments: [],
					createdAt: "2026-04-18T10:00:00.000Z",
					updatedAt: "2026-04-18T10:00:00.000Z",
				};
				writeJsonAtomic(path.join(storageRoot, "cards", `${card.id}.json`), card);
			}
		},
	};
}

function runGit(cwd: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: path.join(cwd, ".gitconfig-empty"),
			SSH_AUTH_SOCK: "",
		},
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}
