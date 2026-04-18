import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createNodeFsTrackboiActions, createRuntime } from "../../src/core";
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
		expect(registry.activeProjectId).toBe(registry.projects[0]?.id ?? null);

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

		const commented = await trackboi.updateCard(created.id, {
			comments: [{
				id: "comment_1",
				author: "Agent",
				body: "Checked the failing path and left a handoff note.",
				createdAt: "2026-04-18T10:02:00.000Z",
				updatedAt: "2026-04-18T10:02:00.000Z",
			}],
		});
		expect(commented.comments).toHaveLength(1);
		expect(commented.comments[0]?.author).toBe("Agent");

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
			source: { kind: "branch", ref: "feat/track-actions" },
		});
		expect(created.source.kind).toBe("branch");

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
