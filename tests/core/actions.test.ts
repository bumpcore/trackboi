import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createNodeFsTrackboiActions, createRuntime } from "../../src/core";
import { writeFrontmatter } from "../../src/core/frontmatter";
import { writeJsonAtomic } from "../../src/core/json";
import type { Board, Card, ProjectMetadata } from "../../src/core/types";

const createdRoots: string[] = [];

afterEach(() => {
	for (const root of createdRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("nodefs trackboi actions", () => {
	test("chooseProject and openWorkspaceFile use injected dialogs", async () => {
		const fixture = createActionsFixture();
		fixture.seedStore(fixture.repo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [],
		});

		const workspaceFile = path.join(fixture.root, "demo.code-workspace");
		writeFileSync(workspaceFile, "{}\n");

		const trackboi = createNodeFsTrackboiActions({
			runtime: createRuntime({ configPath: fixture.configPath, legacyConfigPaths: [] }),
			dialogs: {
				chooseProjectDirectory: async () => fixture.repo,
				chooseWorkspaceFile: async () => workspaceFile,
			},
		});

		const snapshot = await trackboi.chooseProject();
		expect(snapshot?.project.path).toBe(fixture.repo);

		const registry = await trackboi.listProjects();
		expect(registry.projects.map((project) => project.path)).toContain(fixture.repo);
		expect(registry.activeProjectPath).toBe(registry.projects[0]?.path ?? null);

		await trackboi.openWorkspaceFile();
		expect(trackboi.readRegistry().activeWorkspaceFile).toBe(workspaceFile);
	});

	test("card mutations flow through the runtime-backed actions facade", async () => {
		const fixture = createActionsFixture();
		fixture.seedStore(fixture.repo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [
					{ id: "todo", name: "To Do" },
					{ id: "done", name: "Done" },
				],
			},
			cards: [],
		});

		const trackboi = createNodeFsTrackboiActions({
			runtime: createRuntime({ configPath: fixture.configPath, legacyConfigPaths: [] }),
			dialogs: {
				chooseProjectDirectory: async () => fixture.repo,
			},
		});

		await trackboi.chooseProject();
		const created = await trackboi.createCard({
			title: "Actions test card",
			column: "todo",
			scope: { kind: "project", ref: "global" },
		});
		expect(created.title).toBe("Actions test card");

		const updated = await trackboi.updateCard(created.id, { title: "Updated through actions" });
		expect(updated.title).toBe("Updated through actions");

		const comment = await trackboi.addCardComment({
			cardId: created.id,
			body: "Checked the failing path and left a handoff note.",
		});
		const snapshotWithComment = await trackboi.getActiveProject();
		const commented = snapshotWithComment?.cards.find((card) => card.id === created.id);
		expect(commented?.comments).toHaveLength(1);
		expect(comment?.body).toBe("Checked the failing path and left a handoff note.");

		const moved = await trackboi.moveCard(created.id, "done", null);
		expect(moved.column).toBe("done");

		await trackboi.deleteCard(created.id);
		const snapshot = await trackboi.getActiveProject();
		expect(snapshot?.cards.find((card) => card.id === created.id)).toBeUndefined();
	});

	test("track mutations and files flow through the runtime-backed actions facade", async () => {
		const fixture = createActionsFixture();
		fixture.seedStore(fixture.repo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [],
		});

		const trackboi = createNodeFsTrackboiActions({
			runtime: createRuntime({ configPath: fixture.configPath, legacyConfigPaths: [] }),
			dialogs: {
				chooseProjectDirectory: async () => fixture.repo,
			},
		});

		await trackboi.chooseProject();
		const created = await trackboi.createTrack({
			title: "Track actions",
		});
		expect(created.title).toBe("Track actions");

		const file = await trackboi.writeTrackFile({
			trackId: created.id,
			name: "handoff.md",
			content: "Next agent should verify the selector path.",
		});
		expect(file.name).toBe("handoff.md");

		const readBack = await trackboi.readTrackFile(created.id, "handoff.md");
		expect(readBack.content).toContain("selector path");

		const updated = await trackboi.updateTrack(created.id, {
			summary: "Shared track memory",
		});
		expect(updated.summary).toBe("Shared track memory");

		const linked = await trackboi.createCard({
			title: "Linked through actions",
			column: "todo",
			trackId: created.id,
		});
		expect(linked.trackId).toBe(created.id);

		await trackboi.deleteTrack(created.id);
		const snapshot = await trackboi.getActiveProject();
		expect(snapshot?.tracks.find((track) => track.id === created.id)).toBeUndefined();
		expect(snapshot?.cards.find((card) => card.id === linked.id)?.trackId).toBeNull();
	});

	test("explicit actor ids are stamped onto card, comment, and track mutations", async () => {
		const fixture = createActionsFixture();
		fixture.seedStore(fixture.repo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [],
		});

		const trackboi = createNodeFsTrackboiActions({
			runtime: createRuntime({ configPath: fixture.configPath, legacyConfigPaths: [] }),
			dialogs: {
				chooseProjectDirectory: async () => fixture.repo,
			},
		});

		await trackboi.chooseProject();
		const created = await trackboi.createCard({
			title: "Actor stamped card",
			column: "todo",
			actorId: "agent_codex",
		});
		expect(created.createdBy).toBe("agent_codex");

		const updated = await trackboi.updateCard(created.id, {
			title: "Actor stamped update",
			actorId: "agent_codex_2",
		});
		expect(updated.updatedBy).toBe("agent_codex_2");

		const comment = await trackboi.addCardComment({
			cardId: created.id,
			body: "Tracked by agent identity.",
			actorId: "agent_codex_3",
		});
		expect(comment.createdBy).toBe("agent_codex_3");

		const track = await trackboi.createTrack({
			title: "Actor stamped track",
			actorId: "agent_codex_4",
		});
		expect(track.createdBy).toBe("agent_codex_4");
	});

	test("board actions flow through the runtime-backed actions facade", async () => {
		const fixture = createActionsFixture();
		fixture.seedStore(fixture.repo, ".trackboi", {
			board: {
				name: "Main board",
				columns: [{ id: "todo", name: "To Do" }],
			},
			cards: [],
		});

		const trackboi = createNodeFsTrackboiActions({
			runtime: createRuntime({ configPath: fixture.configPath, legacyConfigPaths: [] }),
			dialogs: {
				chooseProjectDirectory: async () => fixture.repo,
			},
		});

		await trackboi.chooseProject();
		const createdSnapshot = await trackboi.createBoard({ name: "Delivery" });
		const createdBoard = createdSnapshot.boards.find((board) => board.name === "Delivery");

		expect(createdBoard).toBeDefined();
		await trackboi.setActiveBoard(createdBoard?.id ?? "");
		const createdCard = await trackboi.createCard({
			title: "Board scoped card",
			column: "todo",
		});
		expect(createdCard.boardId).toBe(createdBoard?.id);

		await trackboi.updateCard(createdCard.id, { boardId: "default" });
		const deletedSnapshot = await trackboi.deleteBoard(createdBoard?.id ?? "");
		expect(deletedSnapshot.boards.map((board) => board.id)).not.toContain(createdBoard?.id);
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
		id?: string;
		name: string;
		columns: Board["columns"];
	};
	cards: SeedCard[];
};

function createActionsFixture() {
	const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-actions-"));
	createdRoots.push(root);

	const repo = path.join(root, "repo");
	runGit(root, ["init", "--initial-branch=master", repo]);
	writeFileSync(path.join(repo, "README.md"), "# Actions fixture\n");
	runGit(repo, ["config", "user.name", "Trackboi Tests"]);
	runGit(repo, ["config", "user.email", "tests@trackboi.local"]);
	runGit(repo, ["add", "."]);
	runGit(repo, ["commit", "-m", "Initial fixture"]);

	return {
		root,
		repo,
		configPath: path.join(root, "config.json"),
		seedStore(projectPath: string, storagePath: string, input: SeedStoreInput) {
			const storageRoot = path.join(projectPath, storagePath);
			const board: Board = {
				id: input.board.id ?? "default",
				version: 1,
				name: input.board.name,
				columns: input.board.columns,
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
		createdAt: timestamp,
		updatedAt: timestamp,
		createdBy: "person_fixture",
		updatedBy: "person_fixture",
	};
	const cardRoot = path.join(storageRoot, "cards", seed.id);
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
