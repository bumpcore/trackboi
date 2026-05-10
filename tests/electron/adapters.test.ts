import { describe, expect, mock, test } from "bun:test";
import type { TrackboiBridgeApi, WindowBridgeApi } from "../../src/electron/bridge";
import { createDesktopFacade } from "../../src/electron/renderer";
import { createIpcTrackboiActions } from "../../src/electron/trackboi";
import { createWindowShell } from "../../src/electron/window";
import type { Track } from "../../src/core/types";

function trackResult(): Track {
	return {
		id: "track_1",
		boardId: "default",
		title: "Track",
		slug: "track",
		summary: "",
		brief: "",
		decisions: [],
		references: [],
		files: [],
		createdAt: "2026-04-18T10:00:00.000Z",
		updatedAt: "2026-04-18T10:00:00.000Z",
		createdBy: "person_unknown",
		updatedBy: "person_unknown",
	};
}

function createTrackboiBridge(overrides: Partial<TrackboiBridgeApi> = {}): TrackboiBridgeApi {
	return {
		getActiveProject: async () => null,
		listProjects: async () => ({ projects: [], activeProjectPath: null, storageSearchPaths: [], activeWorkspaceFile: null, selectedWorktreeId: null, selectedBoardId: null, appSettings: { version: 1, agents: [], agentContexts: [], editor: { preferredEditorId: "auto", customCommand: "" } } }),
		listView: async () => ({ sources: [], activeProjectPath: null, storageSearchPaths: [] }),
		readDesktopState: async () => ({ snapshot: null, view: { sources: [], activeProjectPath: null, storageSearchPaths: [] }, worktrees: [], selectedWorktreeId: null, selectedBoardId: null }),
		prewarmProjects: async () => {},
		setSelectedWorktree: async () => ({ snapshot: null, view: { sources: [], activeProjectPath: null, storageSearchPaths: [] }, worktrees: [], selectedWorktreeId: null, selectedBoardId: null }),
		listBoards: async () => [],
		setActiveBoard: async () => ({ snapshot: null, view: { sources: [], activeProjectPath: null, storageSearchPaths: [] }, worktrees: [], selectedWorktreeId: null, selectedBoardId: null }),
		readAppSettings: async () => ({ version: 1, agents: [], agentContexts: [], editor: { preferredEditorId: "auto", customCommand: "" } }),
		updateAppSettings: async (settings) => settings,
		listGitChanges: async () => ({ repoRoot: "/repo", defaultPaths: [".trackboi"], changes: [] }),
		commitGitChanges: async (input) => ({ ok: true, commit: "abc1234", message: input.message, paths: input.paths ?? [".trackboi"] }),
		listDetectedEditors: async () => [],
		openCardInEditor: async () => ({ ok: true }),
		setStorageSearchPaths: async () => ({ sources: [], activeProjectPath: null, storageSearchPaths: [] }),
		setActiveWorkspaceFile: async () => ({ sources: [], activeProjectPath: null, storageSearchPaths: [] }),
		createBoard: async () => ({ project: {} as never, metadata: {} as never, git: {} as never, board: { id: "default", version: 1, name: "Board", columns: [], customFields: [] }, boards: [], tracks: [], cards: [] }),
		deleteBoard: async () => ({ project: {} as never, metadata: {} as never, git: {} as never, board: { id: "default", version: 1, name: "Board", columns: [], customFields: [] }, boards: [], tracks: [], cards: [] }),
		openWorkspaceFile: async () => null,
		chooseProjectIconFile: async () => null,
		chooseProject: async () => null,
		locateProject: async () => null,
		removeProject: async () => null,
		switchProject: async () => ({ snapshot: null, view: { sources: [], activeProjectPath: null, storageSearchPaths: [] }, worktrees: [], selectedWorktreeId: null, selectedBoardId: null }),
		createCard: async () => ({
			id: "card_1",
			boardId: "default",
			title: "Card",
			description: "",
			parentId: null,
			scope: { kind: "project", ref: "global" },
			trackId: null,
			column: "todo",
			rank: "a0",
			labels: [],
			assignee: null,
			fieldValues: {},
			comments: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
			createdBy: "person_unknown",
			updatedBy: "person_unknown",
		}),
		updateCard: async () => ({
			id: "card_1",
			boardId: "default",
			title: "Card",
			description: "",
			parentId: null,
			scope: { kind: "project", ref: "global" },
			trackId: null,
			column: "todo",
			rank: "a0",
			labels: [],
			assignee: null,
			fieldValues: {},
			comments: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
			createdBy: "person_unknown",
			updatedBy: "person_unknown",
		}),
		updateBoard: async () => ({ id: "default", version: 1, name: "Board", columns: [], customFields: [] }),
		updateProjectSettings: async (patch) => ({
			version: 1,
			name: "Project",
			color: patch.color ?? null,
			iconPath: patch.iconPath ?? null,
			people: [],
			agents: [],
		}),
		updateProjectPeople: async () => ({
			version: 1,
			name: "Project",
			people: [],
			agents: [],
		}),
		addCardComment: async () => ({
			id: "comment_1",
			cardId: "card_1",
			body: "Comment",
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
			createdBy: "person_unknown",
			updatedBy: "person_unknown",
		}),
		moveCard: async () => ({
			id: "card_1",
			boardId: "default",
			title: "Card",
			description: "",
			parentId: null,
			scope: { kind: "project", ref: "global" },
			trackId: null,
			column: "done",
			rank: "a0",
			labels: [],
			assignee: null,
			fieldValues: {},
			comments: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
			createdBy: "person_unknown",
			updatedBy: "person_unknown",
		}),
		deleteCard: async () => ({ ok: true }),
		listTracks: async () => [],
		getTrack: async () => trackResult(),
		createTrack: async () => trackResult(),
		updateTrack: async () => trackResult(),
		deleteTrack: async () => ({ ok: true }),
		readTrackFile: async () => ({ name: "notes.md", contentType: "text/markdown", content: "# Notes", updatedAt: "2026-04-18T10:00:00.000Z" }),
		writeTrackFile: async () => ({ name: "notes.md", path: "tracks/track_1/files/notes.md", contentType: "text/markdown", updatedAt: "2026-04-18T10:00:00.000Z" }),
		deleteTrackFile: async () => ({ ok: true }),
		onDesktopStorePatch: () => () => {},
		...overrides,
	};
}

function createWindowBridge(overrides: Partial<WindowBridgeApi> = {}): WindowBridgeApi {
	return {
		minimize: async () => {},
		toggleMaximize: async () => {},
		close: async () => {},
		startDrag: async () => {},
		startResize: async () => {},
		...overrides,
	};
}

describe("electron adapters", () => {
	test("ipc trackboi actions delegate to the bridge contract", async () => {
		const createCard = mock(async () => ({
			id: "card_1",
			boardId: "default",
			title: "Created",
			description: "",
			parentId: null,
			scope: { kind: "project", ref: "global" as const },
			trackId: null,
			column: "todo",
			rank: "a0",
			labels: [],
			assignee: null,
			fieldValues: {},
			comments: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
		}));
		const onDesktopStorePatch = mock((listener: (patch: { type: string }) => void) => {
			listener({ type: "contextReplaced" });
			return () => {};
		});
		const bridge = createTrackboiBridge({ createCard, onDesktopStorePatch });
		const trackboi = createIpcTrackboiActions(bridge);

		const card = await trackboi.createCard({ title: "Created", column: "todo" });
		expect(card.title).toBe("Created");
		expect(createCard).toHaveBeenCalledTimes(1);

		const listener = mock(() => {});
		trackboi.onDesktopStorePatch(listener);
		expect(onDesktopStorePatch).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith({ type: "contextReplaced" });
	});

	test("desktop facade schedules background project prewarming after desktop reads", async () => {
		const prewarmProjects = mock(async () => {});
		const desktop = createDesktopFacade(createTrackboiBridge({ prewarmProjects }), createWindowBridge());

		await desktop.readDesktopState();
		await new Promise((resolve) => setTimeout(resolve, 170));

		expect(prewarmProjects).toHaveBeenCalledTimes(1);
	});

	test("desktop facade delegates track mutations without forcing a reread", async () => {
		const createTrack = mock(async () => trackResult());
		const getActiveProject = mock(async () => null);
		const trackboi = createTrackboiBridge({ createTrack, getActiveProject });
		const desktop = createDesktopFacade(trackboi, createWindowBridge());

		const track = await desktop.createTrack({ title: "Track" });

		expect(track.title).toBe("Track");
		expect(createTrack).toHaveBeenCalledTimes(1);
		expect(getActiveProject).not.toHaveBeenCalled();
	});

	test("desktop facade delegates git commit actions through the bridge", async () => {
		const listGitChanges = mock(async () => ({
			repoRoot: "/repo",
			defaultPaths: [".trackboi"],
			changes: [{ path: ".trackboi/cards/card/index.md", indexStatus: " ", worktreeStatus: "M" }],
		}));
		const commitGitChanges = mock(async () => ({ ok: true as const, commit: "abc1234", message: "Update board", paths: [".trackboi"] }));
		const desktop = createDesktopFacade(createTrackboiBridge({ listGitChanges, commitGitChanges }), createWindowBridge());

		const changes = await desktop.listGitChanges();
		const result = await desktop.commitGitChanges({ message: "Update board" });

		expect(changes.changes[0]?.path).toBe(".trackboi/cards/card/index.md");
		expect(result.commit).toBe("abc1234");
		expect(listGitChanges).toHaveBeenCalledTimes(1);
		expect(commitGitChanges).toHaveBeenCalledWith({ message: "Update board", paths: undefined });
	});

	test("window shell delegates to the dedicated window bridge", async () => {
		const minimize = mock(async () => {});
		const toggleMaximize = mock(async () => {});
		const close = mock(async () => {});
		const startResize = mock(async (_edge: string) => {});
		const bridge = createWindowBridge({ minimize, toggleMaximize, close, startResize });
		const windowShell = createWindowShell(bridge);

		await windowShell.minimize();
		await windowShell.toggleMaximize();
		await windowShell.close();
		await windowShell.startResize("se");
		expect(minimize).toHaveBeenCalledTimes(1);
		expect(toggleMaximize).toHaveBeenCalledTimes(1);
		expect(close).toHaveBeenCalledTimes(1);
		expect(startResize).toHaveBeenCalledWith("se");
	});

	test("desktop facade forwards desktop-store patch events", async () => {
		let onDesktopStorePatchListener: (() => void) | null = null;
		const trackboi = createTrackboiBridge({
			onDesktopStorePatch: (listener) => {
				onDesktopStorePatchListener = () => listener({ type: "contextReplaced", state: { snapshot: null, view: { sources: [], activeProjectPath: null, storageSearchPaths: [] }, worktrees: [], selectedWorktreeId: null, selectedBoardId: null } });
				return () => {};
			},
		});

		const desktop = createDesktopFacade(trackboi, createWindowBridge());
		const patchListener = mock(() => {});
		desktop.addDesktopStorePatchListener(patchListener);
		onDesktopStorePatchListener?.();

		expect(patchListener).toHaveBeenCalledTimes(1);
		expect(patchListener).toHaveBeenCalledWith({
			type: "contextReplaced",
			state: {
				snapshot: null,
				view: { sources: [], activeProjectPath: null, storageSearchPaths: [] },
				worktrees: [],
				selectedWorktreeId: null,
				selectedBoardId: null,
			},
		});
	});
});
