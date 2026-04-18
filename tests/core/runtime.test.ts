import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
		expect(card.comments).toEqual([]);
	});

	test("updateCard persists comments and normalizes missing comment arrays from disk", () => {
		const fixture = createRuntimeFixture();
		fixture.seedStore(fixture.mainRepo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [{
				id: "card_main_1",
				title: "Legacy card",
				description: "",
				column: "todo",
				rank: "a0",
				scope: { kind: "project", ref: "global" },
				updatedAt: "2026-04-18T10:00:00.000Z",
			}],
		});

		const legacyCardPath = path.join(fixture.mainRepo, ".trackboi/cards/card_main_1.json");
		const legacyCard = JSON.parse(readFileSync(legacyCardPath, "utf8")) as Record<string, unknown>;
		delete legacyCard.comments;
		writeJsonAtomic(legacyCardPath, legacyCard);

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);

		expect(runtime.readDesktopState().snapshot?.cards[0]?.comments).toEqual([]);

		const updated = runtime.updateCard("card_main_1", {
			comments: [{
				id: "comment_1",
				author: "Agent",
				body: "Left context for the next pass.",
				createdAt: "2026-04-18T10:04:00.000Z",
				updatedAt: "2026-04-18T10:04:00.000Z",
			}],
		});

		expect(updated.comments).toHaveLength(1);
		expect(runtime.readDesktopState().snapshot?.cards[0]?.comments[0]?.body).toBe("Left context for the next pass.");
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

	test("readDesktopState does not rewrite normalized board or project files", () => {
		const fixture = createRuntimeFixture();
		fixture.seedStore(fixture.mainRepo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [{
				id: "card_main_1",
				title: "Steady read",
				description: "",
				column: "todo",
				rank: "a0",
				scope: { kind: "project", ref: "global" },
				updatedAt: "2026-04-18T10:00:00.000Z",
			}],
		});

		const boardFile = path.join(fixture.mainRepo, ".trackboi/boards/default.json");
		const projectFile = path.join(fixture.mainRepo, ".trackboi/project.json");
		const boardMtimeBefore = statSync(boardFile).mtimeMs;
		const projectMtimeBefore = statSync(projectFile).mtimeMs;

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);
		runtime.readDesktopState();
		runtime.readDesktopState();

		expect(statSync(boardFile).mtimeMs).toBe(boardMtimeBefore);
		expect(statSync(projectFile).mtimeMs).toBe(projectMtimeBefore);
	});

	test("surfaces legacy branch-scoped cards as synthetic tracks and materializes them on edit", () => {
		const fixture = createRuntimeFixture();
		fixture.seedStore(fixture.mainRepo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [{
				id: "card_legacy_track",
				title: "Legacy branch card",
				description: "",
				column: "todo",
				rank: "a0",
				scope: { kind: "track", ref: "feature/onboarding" },
				updatedAt: "2026-04-18T11:00:00.000Z",
			}],
		});

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);

		const before = runtime.readDesktopState().snapshot;
		const syntheticTrack = before?.tracks.find((track) => track.source.kind === "branch" && track.source.ref === "feature/onboarding");
		const legacyCard = before?.cards.find((card) => card.id === "card_legacy_track");

		expect(syntheticTrack?.synthetic).toBe(true);
		expect(legacyCard?.trackId).toBe(syntheticTrack?.id);

		const updated = runtime.updateCard("card_legacy_track", {
			title: "Materialized branch card",
		});

		const after = runtime.readDesktopState().snapshot;
		const materializedTrack = after?.tracks.find((track) => (
			track.source.kind === "branch" &&
			track.source.ref === "feature/onboarding" &&
			!track.synthetic
		));
		const cardFile = JSON.parse(readFileSync(
			path.join(fixture.mainRepo, ".trackboi/cards/card_legacy_track.json"),
			"utf8",
		)) as Card;

		expect(materializedTrack).toBeDefined();
		expect(updated.trackId).toBe(materializedTrack?.id);
		expect(cardFile.trackId).toBe(materializedTrack?.id);
		expect(cardFile.scope).toEqual({ kind: "project", ref: "global" });
	});

	test("creates, updates, reads, and deletes tracks plus track files", () => {
		const fixture = createRuntimeFixture();
		fixture.seedStore(fixture.mainRepo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [],
		});

		const runtime = fixture.runtime();
		runtime.chooseProjectPath(fixture.mainRepo);

		const created = runtime.createTrack({
			title: "Inspector rewrite",
			source: { kind: "branch", ref: "feat/inspector-rewrite" },
			summary: "Lift track planning above cards.",
		});

		expect(runtime.listTracks().map((track) => track.id)).toContain(created.id);

		const updated = runtime.updateTrack(created.id, {
			plan: "1. Add track filter\n2. Dock inspector\n3. Materialize legacy refs",
			decisions: [{
				id: "decision_1",
				title: "Use real track records",
				body: "Avoid branch-only implicit scope for new writes.",
				status: "accepted",
				createdAt: "2026-04-18T11:10:00.000Z",
				updatedAt: "2026-04-18T11:10:00.000Z",
			}],
		});

		expect(updated.plan).toContain("Dock inspector");
		expect(updated.decisions).toHaveLength(1);

		const file = runtime.writeTrackFile({
			trackId: created.id,
			name: "notes.md",
			content: "# Notes\n\nTrack-local context.",
		});
		expect(file.name).toBe("notes.md");

		const readBack = runtime.readTrackFile(created.id, "notes.md");
		expect(readBack.content).toContain("Track-local context");

		const snapshotWithTrack = runtime.readDesktopState().snapshot;
		expect(snapshotWithTrack?.tracks.find((track) => track.id === created.id)?.files.map((entry) => entry.name)).toContain("notes.md");

		const card = runtime.createCard({
			title: "Linked card",
			column: "todo",
			trackId: created.id,
		});
		expect(card.trackId).toBe(created.id);

		runtime.deleteTrackFile(created.id, "notes.md");
		expect(runtime.readDesktopState().snapshot?.tracks.find((track) => track.id === created.id)?.files).toEqual([]);

		runtime.deleteTrack(created.id);
		const afterDelete = runtime.readDesktopState().snapshot;
		expect(afterDelete?.tracks.find((track) => track.id === created.id)).toBeUndefined();
		expect(afterDelete?.cards.find((entry) => entry.id === card.id)?.trackId).toBeNull();
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
		trackId: null,
		column: seed.column,
		rank: seed.rank,
		labels: [],
		assignee: null,
		fieldValues: {},
		comments: [],
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
