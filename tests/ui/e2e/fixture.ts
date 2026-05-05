import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ElectronApplication, Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import electronBinary from "electron";
import { writeFrontmatter } from "../../../src/core/frontmatter";
import { writeJsonAtomic } from "../../../src/core/json";
import type { Board, Card, ProjectMetadata, ProjectRegistry, Track } from "../../../src/core/types";

type SeedCard = {
	id: string;
	boardId?: string;
	title: string;
	description: string;
	column: string;
	rank: string;
	trackId?: string | null;
};

type SeedTrack = {
	id: string;
	title: string;
	slug: string;
	summary: string;
	brief?: string;
};

type SeedStoreInput = {
	board: {
		id?: string;
		name: string;
		columns: Board["columns"];
	};
	extraBoards?: Array<{
		id: string;
		name: string;
		columns: Board["columns"];
	}>;
	cards: SeedCard[];
	tracks?: SeedTrack[];
};

export const seededIds = {
	cardAlpha: "card_alpha",
	cardBeta: "card_beta",
	cardGamma: "card_gamma",
	cardDelivery: "card_delivery",
	cardOnboarding: "card_onboarding",
	trackMain: "track_main",
};

export type UiFixture = {
	root: string;
	repoPath: string;
	onboardingWorktreePath: string;
	checkoutWorktreePath: string;
	configHome: string;
	launch(): Promise<{ app: ElectronApplication; page: Page }>;
	cleanup(): void;
};

export function createUiFixture(): UiFixture {
	const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-ui-"));
	const repoPath = path.join(root, "repo");
	runGit(root, ["init", "--initial-branch=master", repoPath]);
	writeFileSync(path.join(repoPath, "README.md"), "# Trackboi UI fixture\n");
	runGit(repoPath, ["config", "user.name", "Trackboi UI Tests"]);
	runGit(repoPath, ["config", "user.email", "ui-tests@trackboi.local"]);
	runGit(repoPath, ["add", "."]);
	runGit(repoPath, ["commit", "-m", "Initial fixture"]);

	const worktreeRoot = path.join(root, "worktrees");
	mkdirSync(worktreeRoot, { recursive: true });
	const onboardingWorktreePath = path.join(worktreeRoot, "onboarding");
	const checkoutWorktreePath = path.join(worktreeRoot, "checkout-mcp");
	runGit(repoPath, ["worktree", "add", "-b", "feature/onboarding", onboardingWorktreePath]);
	runGit(repoPath, ["worktree", "add", "-b", "spike/checkout", checkoutWorktreePath]);

	seedStore(repoPath, ".trackboi", {
		board: {
			name: "Trackboi board",
			columns: [
				{ id: "todo", name: "To Do" },
				{ id: "doing", name: "Doing" },
				{ id: "done", name: "Done" },
			],
		},
		extraBoards: [{
			id: "delivery",
			name: "Delivery board",
			columns: [
				{ id: "todo", name: "Queued" },
				{ id: "doing", name: "In Progress" },
				{ id: "done", name: "Shipped" },
			],
		}],
		tracks: [{
			id: seededIds.trackMain,
			title: "Master",
			slug: "master",
			summary: "Primary track context for the main board.",
		}],
		cards: [{
			id: seededIds.cardAlpha,
			title: "Alpha task",
			description: "First todo card.",
			column: "todo",
			rank: "a0",
		}, {
			id: seededIds.cardBeta,
			title: "Beta task",
			description: "Second todo card.",
			column: "todo",
			rank: "a1",
			trackId: seededIds.trackMain,
		}, {
			id: seededIds.cardGamma,
			title: "Gamma done",
			description: "Already shipped work.",
			column: "done",
			rank: "a2",
		}, {
			id: seededIds.cardDelivery,
			boardId: "delivery",
			title: "Delivery board card",
			description: "Only visible on the delivery board.",
			column: "todo",
			rank: "a0",
		}],
	});

	seedStore(onboardingWorktreePath, ".etc/.trackboi", {
		board: {
			name: "Onboarding board",
			columns: [
				{ id: "todo", name: "To Do" },
				{ id: "doing", name: "Doing" },
			],
		},
		cards: [{
			id: seededIds.cardOnboarding,
			title: "Onboarding context card",
			description: "Visible only in the onboarding worktree context.",
			column: "todo",
			rank: "a0",
		}],
	});

	seedStore(checkoutWorktreePath, ".etc/trackboi", {
		board: {
			name: "Checkout board",
			columns: [
				{ id: "todo", name: "Queued" },
				{ id: "doing", name: "Review" },
			],
		},
		cards: [{
			id: "card_checkout",
			title: "Checkout context card",
			description: "Visible only in checkout.",
			column: "doing",
			rank: "a0",
		}],
	});

	const configHome = path.join(root, "config-home");
	writeRegistry(root, repoPath);

	return {
		root,
		repoPath,
		onboardingWorktreePath,
		checkoutWorktreePath,
		configHome,
		async launch() {
			const launchEnv = { ...process.env };
			delete launchEnv.ELECTRON_RUN_AS_NODE;
			const app = await electron.launch({
				executablePath: electronBinary,
				args: [path.resolve("dist-node/electron/main.cjs")],
				env: {
					...launchEnv,
					HOME: root,
					XDG_CONFIG_HOME: configHome,
					ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
				},
			});
			const page = await app.firstWindow();
			await page.getByTestId("column-todo-list").waitFor();
			return { app, page };
		},
		cleanup() {
			rmSync(root, { recursive: true, force: true });
		},
	};
}

function writeRegistry(home: string, repoPath: string) {
	const registryDir = path.join(home, ".trackboi");
	const registry: ProjectRegistry = {
		projects: [{
			name: "trackboi",
			path: repoPath,
		}],
		activeProjectPath: repoPath,
		storageSearchPaths: [".trackboi", ".etc/.trackboi", ".etc/trackboi"],
		activeWorkspaceFile: null,
		selectedWorktreeId: repoPath,
		selectedBoardId: "default",
		appSettings: {
			version: 1,
			agents: [],
			agentContexts: [],
			editor: {
				preferredEditorId: "auto",
				customCommand: "",
			},
			userIdentity: {
				displayName: "Fixture User",
				gitName: "Trackboi Tests",
				gitEmail: "tests@trackboi.local",
			},
			onboarding: {
				userComplete: true,
				firstProjectComplete: true,
			},
			shortcuts: {
				leftPanel: "Ctrl+B",
				rightPanel: "Ctrl+Shift+X",
				commandCenterNavigate: "Ctrl+P",
				commandCenterCommand: "Ctrl+Shift+P",
				openSettings: "Ctrl+,",
				addProject: "Ctrl+O",
				newCard: "Ctrl+N",
				newTrack: "Ctrl+Shift+N",
				nextProject: "Ctrl+PageDown",
				previousProject: "Ctrl+PageUp",
				projectSettings: "Ctrl+Alt+,",
				boardSettings: "Ctrl+Alt+B",
				focusBoard: "Ctrl+Alt+0",
			},
		},
	};
	writeJsonAtomic(path.join(registryDir, "config.json"), registry);
}

function seedStore(projectPath: string, storagePath: string, input: SeedStoreInput) {
	const storageRoot = path.join(projectPath, storagePath);
	const metadata: ProjectMetadata = {
		version: 1,
		name: path.basename(projectPath),
		people: [],
		agents: [],
	};
	writeJsonAtomic(path.join(storageRoot, "project.json"), metadata);
	writeBoard(storageRoot, {
		id: input.board.id ?? "default",
		version: 1,
		name: input.board.name,
		columns: input.board.columns,
		customFields: [],
	});
	for (const board of input.extraBoards ?? []) {
		writeBoard(storageRoot, {
			id: board.id,
			version: 1,
			name: board.name,
			columns: board.columns,
			customFields: [],
		});
	}
	for (const track of input.tracks ?? []) {
		writeTrack(storageRoot, track);
	}
	for (const card of input.cards) {
		writeCard(storageRoot, card);
	}
}

function writeBoard(storageRoot: string, board: Board) {
	writeJsonAtomic(path.join(storageRoot, "boards", `${board.id}.json`), board);
}

function writeCard(storageRoot: string, seed: SeedCard) {
	const timestamp = "2026-04-19T00:00:00.000Z";
	const card: Card = {
		id: seed.id,
		boardId: seed.boardId ?? "default",
		title: seed.title,
		description: seed.description,
		parentId: null,
		scope: { kind: "project", ref: "global" },
		trackId: seed.trackId ?? null,
		column: seed.column,
		rank: seed.rank,
		labels: [],
		assignee: null,
		fieldValues: {},
		comments: [],
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

function writeTrack(storageRoot: string, seed: SeedTrack) {
	const timestamp = "2026-04-19T00:00:00.000Z";
	const track: Track = {
		id: seed.id,
		title: seed.title,
		slug: seed.slug,
		summary: seed.summary,
		brief: seed.brief ?? "",
		decisions: [],
		references: [],
		files: [],
		createdAt: timestamp,
		updatedAt: timestamp,
		createdBy: "person_fixture",
		updatedBy: "person_fixture",
	};
	const trackRoot = path.join(storageRoot, "tracks", track.id);
	mkdirSync(path.join(trackRoot, "files"), { recursive: true });
	writeFileSync(path.join(trackRoot, "index.md"), writeFrontmatter({
		id: track.id,
		title: track.title,
		slug: track.slug,
		createdAt: track.createdAt,
		updatedAt: track.updatedAt,
		createdBy: track.createdBy,
		updatedBy: track.updatedBy,
	}, track.summary));
	writeFileSync(path.join(trackRoot, "brief.md"), track.brief);
	writeFileSync(path.join(trackRoot, "decisions.md"), "# Decisions\n");
	writeFileSync(path.join(trackRoot, "references.md"), "# References\n");
}

function runGit(cwd: string, args: string[]) {
	execFileSync("git", args, {
		cwd,
		env: {
			...process.env,
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: path.join(cwd, ".gitconfig-empty"),
			SSH_AUTH_SOCK: "",
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
}
