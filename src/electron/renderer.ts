import type {
	Board,
	CardPatch,
	CreateTrackInput,
	CustomField,
	DesktopState,
	ProjectSnapshot,
	TrackPatch,
	TrackFileWriteInput,
	WorkScope,
} from "@/core/types";
import type { TrackboiBridgeApi, WindowBridgeApi } from "./bridge";
import { trackboi } from "./trackboi";
import { windowShell } from "./window";

type BoardChangedListener = (snapshot: ProjectSnapshot | null) => void;

/**
 * Creates the renderer-side desktop facade by composing the IPC-backed Trackboi
 * actions transport with the dedicated shell window transport.
 */
export function createDesktopFacade(
	trackboiApi: TrackboiBridgeApi = trackboi,
	windowApi: WindowBridgeApi = windowShell,
) {
	const listeners = new Set<BoardChangedListener>();
	let projectChangeListenerStarted = false;
	let projectChangeRefreshQueued = false;

	function notifyListeners(snapshot: ProjectSnapshot | null): void {
		for (const listener of listeners) listener(snapshot);
	}

	async function notifyBoardChanged() {
		const snapshot = await trackboiApi.getActiveProject();
		notifyListeners(snapshot);
		return snapshot;
	}

	/**
	 * Starts the main-to-renderer project-change subscription once and coalesces
	 * bursty filesystem events into one snapshot refresh.
	 */
	function startProjectChangeListener() {
		if (projectChangeListenerStarted) return;
		projectChangeListenerStarted = true;

		trackboiApi.onProjectChanged(() => {
			if (projectChangeRefreshQueued) return;
			projectChangeRefreshQueued = true;
			globalThis.setTimeout(() => {
				projectChangeRefreshQueued = false;
				void notifyBoardChanged();
			}, 120);
		});
	}

	async function refreshAfterMutation<T>(action: () => Promise<T>): Promise<T> {
		const result = await action();
		await notifyBoardChanged();
		return result;
	}

	async function refreshAfterProjectSelection<T>(action: () => Promise<T>, snapshotSelector: (result: T) => ProjectSnapshot | null): Promise<T> {
		const result = await action();
		notifyListeners(snapshotSelector(result));
		return result;
	}

	return {
	async getActiveProject() {
		return trackboiApi.getActiveProject();
	},
	async listProjects() {
		return trackboiApi.listProjects();
	},
	async listView() {
		return trackboiApi.listView();
	},
	async readDesktopState(): Promise<DesktopState> {
		return trackboiApi.readDesktopState();
	},
	async setSelectedWorktree(worktreeId: string | null): Promise<DesktopState> {
		return trackboiApi.setSelectedWorktree(worktreeId);
	},
	async setStorageSearchPaths(paths: string[]) {
		return trackboiApi.setStorageSearchPaths(paths);
	},
	async setActiveWorkspaceFile(filePath: string | null) {
		return trackboiApi.setActiveWorkspaceFile(filePath);
	},
	async listTracks() {
		return trackboiApi.listTracks();
	},
	async getTrack(trackId: string) {
		return trackboiApi.getTrack(trackId);
	},
	async createTrack(input: CreateTrackInput) {
		return refreshAfterMutation(() => trackboiApi.createTrack(input));
	},
	async updateTrack(trackId: string, patch: TrackPatch) {
		return refreshAfterMutation(() => trackboiApi.updateTrack(trackId, patch));
	},
	async deleteTrack(trackId: string) {
		return refreshAfterMutation(() => trackboiApi.deleteTrack(trackId));
	},
	async readTrackFile(trackId: string, fileName: string) {
		return trackboiApi.readTrackFile(trackId, fileName);
	},
	async writeTrackFile(input: TrackFileWriteInput) {
		return refreshAfterMutation(() => trackboiApi.writeTrackFile(input));
	},
	async deleteTrackFile(trackId: string, fileName: string) {
		return refreshAfterMutation(() => trackboiApi.deleteTrackFile(trackId, fileName));
	},
	async openWorkspaceFile() {
		return trackboiApi.openWorkspaceFile();
	},
	async chooseProject() {
		return refreshAfterProjectSelection(() => trackboiApi.chooseProject(), (snapshot) => snapshot);
	},
	async locateProject(projectId: string) {
		return refreshAfterProjectSelection(() => trackboiApi.locateProject(projectId), (snapshot) => snapshot);
	},
	async removeProject(projectId: string) {
		return refreshAfterProjectSelection(() => trackboiApi.removeProject(projectId), (snapshot) => snapshot);
	},
	async switchProject(projectId: string) {
		return refreshAfterProjectSelection(() => trackboiApi.switchProject(projectId), (nextState) => nextState.snapshot);
	},
	async createCard(input: {
		title: string;
		description?: string;
		parentId?: string | null;
		column: string;
		scope?: WorkScope;
		trackId?: string | null;
		targetWorktreeId?: string | null;
	}) {
		return refreshAfterMutation(() => trackboiApi.createCard(input));
	},
	async updateCard(cardId: string, patch: CardPatch) {
		return refreshAfterMutation(() => trackboiApi.updateCard(cardId, patch));
	},
	async updateBoard(board: Board) {
		return refreshAfterMutation(() => trackboiApi.updateBoard(board));
	},
	async updateCustomFields(customFields: CustomField[]) {
		return refreshAfterMutation(() => trackboiApi.updateCustomFields(customFields));
	},
	async moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
		return refreshAfterMutation(() => trackboiApi.moveCard(cardId, toColumn, beforeCardId));
	},
	async deleteCard(cardId: string) {
		return refreshAfterMutation(() => trackboiApi.deleteCard(cardId));
	},
	async minimizeWindow() {
		await windowApi.minimize();
		return { ok: true as const };
	},
	async toggleMaximizeWindow() {
		await windowApi.toggleMaximize();
		return { ok: true as const };
	},
	async closeWindow() {
		await windowApi.close();
		return { ok: true as const };
	},
	async startWindowDrag() {
		await windowApi.startDrag();
	},
	async startResize(edge: string) {
		await windowApi.startResize(edge);
	},
	addBoardChangedListener(listener: BoardChangedListener) {
		startProjectChangeListener();
		listeners.add(listener);
	},
	};
}

export const desktop = createDesktopFacade();

declare global {
	interface Window {
		trackboi: TrackboiBridgeApi;
		trackboiWindow: WindowBridgeApi;
	}
}
