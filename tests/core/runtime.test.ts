import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

describe("runtime worktree integration", () => {
	test("aggregates cards across worktree storage roots and unions columns", () => {
		const fixture = createRuntimeFixture();

		fixture.seedStore(fixture.mainRepo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [
					{ id: "todo", name: "To Do" },
					{ id: "doing", name: "Doing" },
					{ id: "done", name: "Done" },
				],
			},
			cards: [{
				id: "card_main_1",
				title: "Main card",
				description: "Lives in the primary tree.",
				column: "todo",
				rank: "a0",
				scope: { kind: "project", ref: "global" },
				updatedAt: "2026-04-18T08:00:00.000Z",
			}],
		});

		fixture.seedStore(fixture.onboardingWorktree, ".etc/.trackboi", {
			board: {
				name: "Onboarding board",
				columns: [
					{ id: "todo", name: "Backlog" },
					{ id: "review", name: "Review" },
				],
			},
			cards: [{
				id: "card_onboarding_1",
				title: "Onboarding card",
				description: "Lives in onboarding.",
				column: "review",
				rank: "a0",
				scope: { kind: "track", ref: "feature/onboarding" },
				updatedAt: "2026-04-18T08:10:00.000Z",
			}],
		});

		fixture.seedStore(fixture.checkoutWorktree, ".etc/trackboi", {
			board: {
				name: "Checkout board",
				columns: [
					{ id: "todo", name: "Queued" },
					{ id: "qa", name: "QA" },
					{ id: "done", name: "Learned" },
				],
			},
			cards: [{
				id: "card_checkout_1",
				title: "Checkout card",
				description: "Lives in checkout.",
				column: "qa",
				rank: "a0",
				scope: { kind: "track", ref: "spike/checkout-mcp" },
				updatedAt: "2026-04-18T08:20:00.000Z",
			}],
		});

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);
		const state = runtime.readDesktopState();

		expect(state.worktrees.map((worktree) => worktree.name)).toEqual([
			"repo",
			"checkout-mcp",
			"onboarding",
		]);
		expect(state.snapshot?.board.columns.map((column) => column.id)).toEqual([
			"todo",
			"doing",
			"done",
			"qa",
			"review",
		]);
		expect(state.snapshot?.cards.map((card) => card.id).sort()).toEqual([
			"card_checkout_1",
			"card_main_1",
			"card_onboarding_1",
		]);
	});

	test("merges same card id across worktrees and flags conflict with newest winner", () => {
		const fixture = createRuntimeFixture();

		fixture.seedStore(fixture.onboardingWorktree, ".etc/.trackboi", {
			board: {
				name: "Onboarding board",
				columns: [{ id: "doing", name: "Doing" }],
			},
			cards: [{
				id: "card_shared",
				title: "Shared handoff",
				description: "Onboarding variant.",
				column: "doing",
				rank: "a0",
				scope: { kind: "project", ref: "global" },
				updatedAt: "2026-04-18T09:00:00.000Z",
			}],
		});

		fixture.seedStore(fixture.checkoutWorktree, ".etc/trackboi", {
			board: {
				name: "Checkout board",
				columns: [{ id: "doing", name: "Doing" }],
			},
			cards: [{
				id: "card_shared",
				title: "Shared handoff",
				description: "Checkout variant wins.",
				column: "doing",
				rank: "a0",
				scope: { kind: "project", ref: "global" },
				updatedAt: "2026-04-18T09:05:00.000Z",
			}],
		});

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);
		const card = runtime.readDesktopState().snapshot?.cards.find((entry) => entry.id === "card_shared");

		expect(card).toBeDefined();
		expect(card?.description).toBe("Checkout variant wins.");
		expect(card?.conflicted).toBe(true);
		expect(card?.variants?.length).toBe(2);
		expect(card?.worktreeIds?.length).toBe(2);
	});

	test("createCard targets the requested worktree store", () => {
		const fixture = createRuntimeFixture();
		fixture.seedStore(fixture.checkoutWorktree, ".etc/trackboi", {
			board: {
				name: "Checkout board",
				columns: [{ id: "todo", name: "Queued" }],
			},
			cards: [],
		});

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);
		const checkoutId = runtime.readDesktopState().worktrees.find((worktree) => worktree.name === "checkout-mcp")?.id;

		expect(checkoutId).toBeDefined();
		const card = runtime.createCard({
			title: "Targeted create",
			column: "todo",
			targetWorktreeId: checkoutId,
			scope: { kind: "project", ref: "global" },
		});

		const expectedPath = path.join(fixture.checkoutWorktree, ".etc/trackboi/cards", `${card.id}.json`);
		expect(existsSync(expectedPath)).toBe(true);
		expect(card.originWorktreeId).toBe(checkoutId);
	});

	test("cached desktop state stays stable until invalidated, then refreshes from disk", () => {
		const fixture = createRuntimeFixture();
		fixture.seedStore(fixture.mainRepo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [{
				id: "card_main_1",
				title: "Before external write",
				description: "",
				column: "todo",
				rank: "a0",
				scope: { kind: "project", ref: "global" },
				updatedAt: "2026-04-18T10:00:00.000Z",
			}],
		});

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);
		expect(runtime.readDesktopState().snapshot?.cards).toHaveLength(1);

		writeCardFile(path.join(fixture.mainRepo, ".trackboi"), {
			id: "card_main_2",
			title: "External write",
			description: "",
			column: "todo",
			rank: "a1",
			scope: { kind: "project", ref: "global" },
			updatedAt: "2026-04-18T10:01:00.000Z",
		});

		expect(runtime.readDesktopState().snapshot?.cards).toHaveLength(1);

		runtime.invalidateCache();
		expect(runtime.readDesktopState().snapshot?.cards).toHaveLength(2);
	});
});

type SeedCard = {
	id: string;
	title: string;
	description: string;
	column: string;
	rank: string;
	scope: Card["scope"];
	updatedAt: string;
};

type SeedStoreInput = {
	board: {
		name: string;
		columns: Board["columns"];
	};
	cards: SeedCard[];
};

function createRuntimeFixture() {
	const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-runtime-"));
	createdRoots.push(root);

	const repo = path.join(root, "repo");
	runGit(root, ["init", "--initial-branch=master", repo]);
	writeFileSync(path.join(repo, "README.md"), "# Runtime fixture\n");
	runGit(repo, ["config", "user.name", "Trackboi Tests"]);
	runGit(repo, ["config", "user.email", "tests@trackboi.local"]);
	runGit(repo, ["add", "."]);
	runGit(repo, ["commit", "-m", "Initial fixture"]);

	const worktreeRoot = path.join(root, "worktrees");
	mkdirSync(worktreeRoot, { recursive: true });
	runGit(repo, ["worktree", "add", "-b", "feature/onboarding", path.join(worktreeRoot, "onboarding")]);
	runGit(repo, ["worktree", "add", "-b", "spike/checkout-mcp", path.join(worktreeRoot, "checkout-mcp")]);

	const configPath = path.join(root, "config.json");

	return {
		root,
		mainRepo: repo,
		onboardingWorktree: path.join(worktreeRoot, "onboarding"),
		checkoutWorktree: path.join(worktreeRoot, "checkout-mcp"),
		runtime() {
			return createRuntime({ configPath });
		},
		seedStore(projectPath: string, storagePath: string, input: SeedStoreInput) {
			const storageRoot = path.join(projectPath, storagePath);
			const board: Board = {
				version: 1,
				name: input.board.name,
				columns: input.board.columns,
				customFields: [],
			};
			const metadata: ProjectMetadata = {
				version: 1,
				projectId: "fixture-project",
				name: path.basename(projectPath),
				storagePath,
				createdAt: "2026-04-18T07:59:00.000Z",
				customFields: [],
			};
			writeJsonAtomic(path.join(storageRoot, "boards/default.json"), board);
			writeJsonAtomic(path.join(storageRoot, "project.json"), metadata);
			for (const card of input.cards) {
				writeCardFile(storageRoot, card);
			}
		},
	};
}

function writeCardFile(storageRoot: string, seed: SeedCard): void {
	const timestamp = seed.updatedAt;
	const card: Card = {
		id: seed.id,
		boardId: "default",
		title: seed.title,
		description: seed.description,
		parentId: null,
		scope: seed.scope,
		column: seed.column,
		rank: seed.rank,
		labels: [],
		assignee: null,
		fieldValues: {},
		createdAt: timestamp,
		updatedAt: timestamp,
	};
	writeJsonAtomic(path.join(storageRoot, "cards", `${seed.id}.json`), card);
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
