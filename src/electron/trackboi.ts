import type { TrackboiBridgeApi } from "./bridge";

export type IpcTrackboiActions = TrackboiBridgeApi;

/**
 * Wraps the preload bridge in a renderer-local actions object so UI code can
 * depend on Trackboi capabilities instead of raw IPC details.
 */
export function createIpcTrackboiActions(api: TrackboiBridgeApi): IpcTrackboiActions {
	return {
		getActiveProject: () => api.getActiveProject(),
		listProjects: () => api.listProjects(),
		listView: () => api.listView(),
		readDesktopState: () => api.readDesktopState(),
		prewarmProjects: () => api.prewarmProjects(),
		setSelectedWorktree: (worktreeId) => api.setSelectedWorktree(worktreeId),
		listBoards: () => api.listBoards(),
		setActiveBoard: (boardId) => api.setActiveBoard(boardId),
		readAppSettings: () => api.readAppSettings(),
		updateAppSettings: (settings) => api.updateAppSettings(settings),
		listGitChanges: (paths) => api.listGitChanges(paths),
		commitGitChanges: (input) => api.commitGitChanges(input),
		listDetectedEditors: () => api.listDetectedEditors(),
		openCardInEditor: (cardId) => api.openCardInEditor(cardId),
		setStorageSearchPaths: (paths) => api.setStorageSearchPaths(paths),
		setActiveWorkspaceFile: (filePath) => api.setActiveWorkspaceFile(filePath),
		createBoard: (input) => api.createBoard(input),
		deleteBoard: (boardId) => api.deleteBoard(boardId),
		listTracks: () => api.listTracks(),
		getTrack: (trackId) => api.getTrack(trackId),
		createTrack: (input) => api.createTrack(input),
		updateTrack: (trackId, patch) => api.updateTrack(trackId, patch),
		deleteTrack: (trackId) => api.deleteTrack(trackId),
		readTrackFile: (trackId, fileName) => api.readTrackFile(trackId, fileName),
		writeTrackFile: (input) => api.writeTrackFile(input),
		deleteTrackFile: (trackId, fileName) => api.deleteTrackFile(trackId, fileName),
	openWorkspaceFile: () => api.openWorkspaceFile(),
	chooseProjectIconFile: () => api.chooseProjectIconFile(),
	chooseProject: () => api.chooseProject(),
		locateProject: (projectPath) => api.locateProject(projectPath),
		removeProject: (projectPath) => api.removeProject(projectPath),
		switchProject: (projectPath) => api.switchProject(projectPath),
		createCard: (input) => api.createCard(input),
		updateCard: (cardId, patch) => api.updateCard(cardId, patch),
		updateBoard: (board) => api.updateBoard(board),
		updateProjectSettings: (patch) => api.updateProjectSettings(patch),
		updateProjectPeople: (people) => api.updateProjectPeople(people),
		addCardComment: (input) => api.addCardComment(input),
		moveCard: (cardId, toColumn, beforeCardId) => api.moveCard(cardId, toColumn, beforeCardId),
		deleteCard: (cardId) => api.deleteCard(cardId),
		onDesktopStorePatch: (listener) => api.onDesktopStorePatch(listener),
	};
}

const defaultTrackboiBridge = new Proxy({} as TrackboiBridgeApi, {
	get(_target, property) {
		return window.trackboi[property as keyof TrackboiBridgeApi];
	},
});

export const trackboi = createIpcTrackboiActions(defaultTrackboiBridge);
