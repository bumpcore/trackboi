import { afterEach, describe, expect, test } from "bun:test";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeFrontmatter } from "../../src/core/frontmatter";
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

	test("project switching reuses warmed caches instead of rebuilding both projects cold", () => {
		const fixture = createPerformanceFixture();
		fixture.seedStore(fixture.mainRepo, ".trackboi", 1200, "main");
		fixture.seedStore(fixture.secondaryRepo, ".trackboi", 1200, "secondary");

		const cold = benchmarkProjectSwitches(fixture, false);
		const warm = benchmarkProjectSwitches(fixture, true);

		console.info(`runtime switch benchmark: cold=${cold.elapsed.toFixed(2)}ms warm=${warm.elapsed.toFixed(2)}ms`);

		expect(cold.visibleCards).toBeGreaterThan(0);
		expect(warm.visibleCards).toBeGreaterThan(0);
		expect(warm.elapsed).toBeLessThan(cold.elapsed);
	});
});

function benchmarkProjectSwitches(
	fixture: ReturnType<typeof createPerformanceFixture>,
	prewarm: boolean,
): { elapsed: number; visibleCards: number } {
	const runtime = fixture.runtime();
	runtime.chooseProjectPath(fixture.mainRepo);
	runtime.chooseProjectPath(fixture.secondaryRepo);
	if (prewarm) runtime.prewarmProjects();

	const view = runtime.listView();
	const mainProjectPath = view.sources.flatMap((source) => source.entries)
		.find((entry) => entry.path === fixture.mainRepo)?.projectPath;
	const secondaryProjectPath = view.sources.flatMap((source) => source.entries)
		.find((entry) => entry.path === fixture.secondaryRepo)?.projectPath;

	if (!mainProjectPath || !secondaryProjectPath) {
		throw new Error("Expected both benchmark projects to be visible");
	}

	const startedAt = performance.now();
	let visibleCards = 0;

	for (let index = 0; index < 16; index += 1) {
		visibleCards += runtime.switchProject(index % 2 === 0 ? mainProjectPath : secondaryProjectPath).snapshot?.cards.length ?? 0;
	}

	return {
		elapsed: performance.now() - startedAt,
		visibleCards,
	};
}

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
	const secondaryRepo = path.join(root, "secondary");
	runGit(mainRepo, ["worktree", "add", "-b", "feature/onboarding", onboardingWorktree]);
	runGit(mainRepo, ["worktree", "add", "-b", "spike/checkout-mcp", checkoutWorktree]);
	runGit(root, ["init", "--initial-branch=main", secondaryRepo]);
	writeFileSync(path.join(secondaryRepo, "README.md"), "# Secondary perf fixture\n");
	runGit(secondaryRepo, ["config", "user.name", "Trackboi Tests"]);
	runGit(secondaryRepo, ["config", "user.email", "tests@trackboi.local"]);
	runGit(secondaryRepo, ["add", "."]);
	runGit(secondaryRepo, ["commit", "-m", "Initial secondary fixture"]);

	return {
		mainRepo,
		onboardingWorktree,
		checkoutWorktree,
		secondaryRepo,
		runtime: () => createRuntime({ configPath: path.join(root, "config.json") }),
		seedStore(projectPath: string, storagePath: string, cardCount: number, prefix: string) {
			const storageRoot = path.join(projectPath, storagePath);
			const board: Board = {
				id: "default",
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
				name: path.basename(projectPath),
				people: [],
				agents: [],
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
					createdAt: "2026-04-18T10:00:00.000Z",
					updatedAt: "2026-04-18T10:00:00.000Z",
					createdBy: "person_fixture",
					updatedBy: "person_fixture",
				};
				const cardRoot = path.join(storageRoot, "cards", card.id);
				mkdirSync(path.join(cardRoot, "comments"), { recursive: true });
				writeFileSync(path.join(cardRoot, "index.md"), writeFrontmatter({
					id: card.id,
					boardId: card.boardId,
					title: card.title,
					parentId: card.parentId,
					scope: card.scope,
					trackId: card.trackId,
					column: card.column,
					rank: card.rank,
					labels: card.labels,
					assignee: card.assignee,
					fieldValues: card.fieldValues,
					createdAt: card.createdAt,
					updatedAt: card.updatedAt,
					createdBy: card.createdBy,
					updatedBy: card.updatedBy,
				}, card.description));
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
