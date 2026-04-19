import { describe, expect, mock, test } from "bun:test";
import type { TrackboiBridgeApi, WindowBridgeApi } from "../../src/electron/bridge";
import { createDesktopFacade } from "../../src/electron/renderer";
import { createIpcTrackboiActions } from "../../src/electron/trackboi";
import { createWindowShell } from "../../src/electron/window";

function createTrackboiBridge(overrides: Partial<TrackboiBridgeApi> = {}): TrackboiBridgeApi {
	return {
		getActiveProject: async () => null,
		listProjects: async () => ({ projects: [], activeProjectId: null, storageSearchPaths: [], activeWorkspaceFile: null, selectedWorktreeId: null }),
		listView: async () => ({ sources: [], activeProjectId: null, storageSearchPaths: [] }),
		readDesktopState: async () => ({ snapshot: null, view: { sources: [], activeProjectId: null, storageSearchPaths: [] }, worktrees: [], selectedWorktreeId: null }),
		prewarmProjects: async () => {},
		setSelectedWorktree: async () => ({ snapshot: null, view: { sources: [], activeProjectId: null, storageSearchPaths: [] }, worktrees: [], selectedWorktreeId: null }),
		setStorageSearchPaths: async () => ({ sources: [], activeProjectId: null, storageSearchPaths: [] }),
		setActiveWorkspaceFile: async () => ({ sources: [], activeProjectId: null, storageSearchPaths: [] }),
		openWorkspaceFile: async () => null,
		chooseProject: async () => null,
		locateProject: async () => null,
		removeProject: async () => null,
		switchProject: async () => ({ snapshot: null, view: { sources: [], activeProjectId: null, storageSearchPaths: [] }, worktrees: [], selectedWorktreeId: null }),
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
		}),
		updateBoard: async () => ({ version: 1, name: "Board", columns: [], customFields: [] }),
		updateCustomFields: async () => ({
			version: 1,
			projectId: "project_1",
			name: "Project",
			storagePath: ".trackboi",
			createdAt: "2026-04-18T10:00:00.000Z",
			customFields: [],
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
		}),
		deleteCard: async () => ({ ok: true }),
		listTracks: async () => [],
		getTrack: async () => ({
			id: "track_1",
			boardId: "default",
			title: "Track",
			slug: "track",
			source: { kind: "manual" as const },
			summary: "",
			plan: "",
			decisions: [],
			references: [],
			activity: [],
			files: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
		}),
		createTrack: async () => ({
			id: "track_1",
			boardId: "default",
			title: "Track",
			slug: "track",
			source: { kind: "manual" as const },
			summary: "",
			plan: "",
			decisions: [],
			references: [],
			activity: [],
			files: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
		}),
		updateTrack: async () => ({
			id: "track_1",
			boardId: "default",
			title: "Track",
			slug: "track",
			source: { kind: "manual" as const },
			summary: "",
			plan: "",
			decisions: [],
			references: [],
			activity: [],
			files: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
		}),
		deleteTrack: async () => ({ ok: true }),
		readTrackFile: async () => ({ name: "notes.md", contentType: "text/markdown", content: "# Notes", updatedAt: "2026-04-18T10:00:00.000Z" }),
		writeTrackFile: async () => ({ name: "notes.md", path: "tracks/track_1/files/notes.md", contentType: "text/markdown", updatedAt: "2026-04-18T10:00:00.000Z" }),
		deleteTrackFile: async () => ({ ok: true }),
		onProjectChanged: () => () => {},
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
		const onProjectChanged = mock((listener: (payload: { rootPath: string }) => void) => {
			listener({ rootPath: "/tmp/project" });
			return () => {};
		});
		const bridge = createTrackboiBridge({ createCard, onProjectChanged });
		const trackboi = createIpcTrackboiActions(bridge);

		const card = await trackboi.createCard({ title: "Created", column: "todo" });
		expect(card.title).toBe("Created");
		expect(createCard).toHaveBeenCalledTimes(1);

		const listener = mock(() => {});
		trackboi.onProjectChanged(listener);
		expect(onProjectChanged).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith({ rootPath: "/tmp/project" });
	});

	test("desktop facade schedules background project prewarming after desktop reads", async () => {
		const prewarmProjects = mock(async () => {});
		const desktop = createDesktopFacade(createTrackboiBridge({ prewarmProjects }), createWindowBridge());

		await desktop.readDesktopState();
		await new Promise((resolve) => setTimeout(resolve, 170));

		expect(prewarmProjects).toHaveBeenCalledTimes(1);
	});

	test("desktop facade delegates track mutations and notifies listeners", async () => {
		const createTrack = mock(async () => ({
			id: "track_1",
			boardId: "default",
			title: "Track",
			slug: "track",
			source: { kind: "manual" as const },
			summary: "",
			plan: "",
			decisions: [],
			references: [],
			activity: [],
			files: [],
			createdAt: "2026-04-18T10:00:00.000Z",
			updatedAt: "2026-04-18T10:00:00.000Z",
		}));
		const trackboi = createTrackboiBridge({ createTrack });
		const desktop = createDesktopFacade(trackboi, createWindowBridge());
		const boardChanged = mock(() => {});
		desktop.addBoardChangedListener(boardChanged);

		const track = await desktop.createTrack({ title: "Track" });

		expect(track.title).toBe("Track");
		expect(createTrack).toHaveBeenCalledTimes(1);
		expect(boardChanged).toHaveBeenCalledTimes(1);
	});

	test("window shell delegates to the dedicated window bridge", async () => {
		const startResize = mock(async (_edge: string) => {});
		const bridge = createWindowBridge({ startResize });
		const windowShell = createWindowShell(bridge);

		await windowShell.startResize("se");
		expect(startResize).toHaveBeenCalledWith("se");
	});

	test("desktop facade refreshes listeners when project-changed events arrive", async () => {
		let onProjectChangedListener: (() => void) | null = null;
		const getActiveProject = mock(async () => ({
			project: { id: "project_1", name: "Trackboi", path: "/tmp/project" },
			metadata: {
				version: 1,
				projectId: "project_1",
				name: "Trackboi",
				storagePath: ".trackboi",
				createdAt: "2026-04-18T10:00:00.000Z",
				customFields: [],
			},
			git: { isGitRepo: true, root: "/tmp/project", branch: "master", detached: false, dirty: false },
			board: { version: 1, name: "Trackboi", columns: [], customFields: [] },
			tracks: [],
			cards: [],
		}));
		const trackboi = createTrackboiBridge({
			getActiveProject,
			onProjectChanged: (listener) => {
				onProjectChangedListener = () => listener({ rootPath: "/tmp/project" });
				return () => {};
			},
		});

		const desktop = createDesktopFacade(trackboi, createWindowBridge());
		const boardChanged = mock(() => {});
		desktop.addBoardChangedListener(boardChanged);
		onProjectChangedListener?.();
		await new Promise((resolve) => setTimeout(resolve, 150));

		expect(getActiveProject).toHaveBeenCalledTimes(1);
		expect(boardChanged).toHaveBeenCalledTimes(1);
	});
});
