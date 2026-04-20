import { contextBridge, ipcRenderer } from "electron";
import type {
	MoveCardInput,
} from "../core";
import type { TrackboiBridgeApi, WindowBridgeApi } from "./bridge";
import { ipcChannels } from "./ipc";
import type { ProjectChangedPayload } from "./bridge";

/**
 * The only API exposed from Electron preload into the renderer.
 *
 * Keeping this object typed and narrow prevents UI code from reaching Node or
 * Electron directly.
 */
const trackboiApi: TrackboiBridgeApi = {
	getActiveProject: () => ipcRenderer.invoke(ipcChannels.trackboi.getActiveProject),
	listProjects: () => ipcRenderer.invoke(ipcChannels.trackboi.listProjects),
	listView: () => ipcRenderer.invoke(ipcChannels.trackboi.listView),
	readDesktopState: () => ipcRenderer.invoke(ipcChannels.trackboi.readDesktopState),
	prewarmProjects: () => ipcRenderer.invoke(ipcChannels.trackboi.prewarmProjects),
	setSelectedWorktree: (worktreeId) => (
		ipcRenderer.invoke(ipcChannels.trackboi.setSelectedWorktree, worktreeId)
	),
	listBoards: () => ipcRenderer.invoke(ipcChannels.trackboi.listBoards),
	setActiveBoard: (boardId) => ipcRenderer.invoke(ipcChannels.trackboi.setActiveBoard, boardId),
	readAppSettings: () => ipcRenderer.invoke(ipcChannels.trackboi.readAppSettings),
	updateAppSettings: (settings) => ipcRenderer.invoke(ipcChannels.trackboi.updateAppSettings, settings),
	listDetectedEditors: () => ipcRenderer.invoke(ipcChannels.trackboi.listDetectedEditors),
	openCardInEditor: (cardId) => ipcRenderer.invoke(ipcChannels.trackboi.openCardInEditor, cardId),
	setStorageSearchPaths: (paths) => (
		ipcRenderer.invoke(ipcChannels.trackboi.setStorageSearchPaths, paths)
	),
	setActiveWorkspaceFile: (filePath) => (
		ipcRenderer.invoke(ipcChannels.trackboi.setActiveWorkspaceFile, filePath)
	),
	createBoard: (input) => ipcRenderer.invoke(ipcChannels.trackboi.createBoard, input),
	deleteBoard: (boardId) => ipcRenderer.invoke(ipcChannels.trackboi.deleteBoard, boardId),
	listTracks: () => ipcRenderer.invoke(ipcChannels.trackboi.listTracks),
	getTrack: (trackId) => ipcRenderer.invoke(ipcChannels.trackboi.getTrack, trackId),
	createTrack: (input) => ipcRenderer.invoke(ipcChannels.trackboi.createTrack, input),
	updateTrack: (trackId, patch) => (
		ipcRenderer.invoke(ipcChannels.trackboi.updateTrack, trackId, patch)
	),
	deleteTrack: (trackId) => ipcRenderer.invoke(ipcChannels.trackboi.deleteTrack, trackId),
	readTrackFile: (trackId, fileName) => (
		ipcRenderer.invoke(ipcChannels.trackboi.readTrackFile, trackId, fileName)
	),
	writeTrackFile: (input) => ipcRenderer.invoke(ipcChannels.trackboi.writeTrackFile, input),
	deleteTrackFile: (trackId, fileName) => (
		ipcRenderer.invoke(ipcChannels.trackboi.deleteTrackFile, trackId, fileName)
	),
	openWorkspaceFile: () => ipcRenderer.invoke(ipcChannels.trackboi.openWorkspaceFile),
	chooseProject: () => ipcRenderer.invoke(ipcChannels.trackboi.chooseProject),
	locateProject: (projectPath) => (
		ipcRenderer.invoke(ipcChannels.trackboi.locateProject, projectPath)
	),
	removeProject: (projectPath) => (
		ipcRenderer.invoke(ipcChannels.trackboi.removeProject, projectPath)
	),
	switchProject: (projectPath) => ipcRenderer.invoke(ipcChannels.trackboi.switchProject, projectPath),
	createCard: (input) => ipcRenderer.invoke(ipcChannels.trackboi.createCard, input),
	updateCard: (cardId, patch) => (
		ipcRenderer.invoke(ipcChannels.trackboi.updateCard, cardId, patch)
	),
	updateBoard: (board) => ipcRenderer.invoke(ipcChannels.trackboi.updateBoard, board),
	updateProjectPeople: (people) => (
		ipcRenderer.invoke(ipcChannels.trackboi.updateProjectPeople, people)
	),
	addCardComment: (input) => ipcRenderer.invoke(ipcChannels.trackboi.addCardComment, input),
	moveCard: (cardId, toColumn, beforeCardId) => (
		ipcRenderer.invoke(
			ipcChannels.trackboi.moveCard,
			{ cardId, toColumn, beforeCardId } satisfies MoveCardInput,
		)
	),
	deleteCard: (cardId) => ipcRenderer.invoke(ipcChannels.trackboi.deleteCard, cardId),
	onProjectChanged: (listener) => {
		const wrapped = (_event: Electron.IpcRendererEvent, payload: ProjectChangedPayload) => listener(payload);
		ipcRenderer.on(ipcChannels.events.projectChanged, wrapped);
		return () => ipcRenderer.off(ipcChannels.events.projectChanged, wrapped);
	},
};

const windowApi: WindowBridgeApi = {
	minimize: () => ipcRenderer.invoke(ipcChannels.window.minimize) as Promise<void>,
	toggleMaximize: () => ipcRenderer.invoke(ipcChannels.window.toggleMaximize) as Promise<void>,
	close: () => ipcRenderer.invoke(ipcChannels.window.close) as Promise<void>,
	startDrag: () => ipcRenderer.invoke(ipcChannels.window.startDrag) as Promise<void>,
	startResize: (edge) => ipcRenderer.invoke(ipcChannels.window.startResize, edge) as Promise<void>,
};

contextBridge.exposeInMainWorld("trackboi", trackboiApi);
contextBridge.exposeInMainWorld("trackboiWindow", windowApi);
