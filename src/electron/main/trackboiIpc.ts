import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { NodeFsTrackboiActions } from "../../core";
import { ipcChannels } from "../ipc";

/**
 * Registers the business-action IPC contract exposed to the renderer.
 */
export function registerTrackboiIpcHandlers(options: {
	trackboi: NodeFsTrackboiActions;
	getActiveProject(): Promise<Awaited<ReturnType<NodeFsTrackboiActions["getActiveProject"]>>>;
	readDesktopState(): Promise<Awaited<ReturnType<NodeFsTrackboiActions["readDesktopState"]>>>;
}): void {
	const { trackboi, getActiveProject, readDesktopState } = options;

	ipcMain.handle(ipcChannels.trackboi.getActiveProject, () => getActiveProject());
	ipcMain.handle(ipcChannels.trackboi.listProjects, () => trackboi.listProjects());
	ipcMain.handle(ipcChannels.trackboi.listView, () => trackboi.listView());
	// The desktop shell boots and refreshes through readDesktopState(), so this
	// IPC path must also arm the filesystem watcher for external MCP writes.
	ipcMain.handle(ipcChannels.trackboi.readDesktopState, () => readDesktopState());
	ipcMain.handle(ipcChannels.trackboi.prewarmProjects, () => trackboi.prewarmProjects());
	ipcMain.handle(ipcChannels.trackboi.setSelectedWorktree, (_event: IpcMainInvokeEvent, worktreeId: string | null) => (
		trackboi.setSelectedWorktree(worktreeId)
	));
	ipcMain.handle(ipcChannels.trackboi.setStorageSearchPaths, (_event: IpcMainInvokeEvent, paths: string[]) => (
		trackboi.setStorageSearchPaths(paths)
	));
	ipcMain.handle(ipcChannels.trackboi.setActiveWorkspaceFile, (_event: IpcMainInvokeEvent, filePath: string | null) => (
		trackboi.setActiveWorkspaceFile(filePath)
	));
	ipcMain.handle(ipcChannels.trackboi.listTracks, () => trackboi.listTracks());
	ipcMain.handle(ipcChannels.trackboi.getTrack, (_event: IpcMainInvokeEvent, trackId: string) => trackboi.getTrack(trackId));
	ipcMain.handle(ipcChannels.trackboi.createTrack, (_event: IpcMainInvokeEvent, input) => trackboi.createTrack(input));
	ipcMain.handle(ipcChannels.trackboi.updateTrack, (_event: IpcMainInvokeEvent, trackId: string, patch) => (
		trackboi.updateTrack(trackId, patch)
	));
	ipcMain.handle(ipcChannels.trackboi.deleteTrack, (_event: IpcMainInvokeEvent, trackId: string) => trackboi.deleteTrack(trackId));
	ipcMain.handle(ipcChannels.trackboi.readTrackFile, (_event: IpcMainInvokeEvent, trackId: string, fileName: string) => (
		trackboi.readTrackFile(trackId, fileName)
	));
	ipcMain.handle(ipcChannels.trackboi.writeTrackFile, (_event: IpcMainInvokeEvent, input) => trackboi.writeTrackFile(input));
	ipcMain.handle(ipcChannels.trackboi.deleteTrackFile, (_event: IpcMainInvokeEvent, trackId: string, fileName: string) => (
		trackboi.deleteTrackFile(trackId, fileName)
	));
	ipcMain.handle(ipcChannels.trackboi.openWorkspaceFile, () => trackboi.openWorkspaceFile());
	ipcMain.handle(ipcChannels.trackboi.chooseProject, () => trackboi.chooseProject());
	ipcMain.handle(ipcChannels.trackboi.locateProject, (_event: IpcMainInvokeEvent, projectId: string) => (
		trackboi.locateProject(projectId)
	));
	ipcMain.handle(ipcChannels.trackboi.removeProject, (_event: IpcMainInvokeEvent, projectId: string) => (
		trackboi.removeProject(projectId)
	));
	ipcMain.handle(ipcChannels.trackboi.switchProject, (_event: IpcMainInvokeEvent, projectId: string) => (
		trackboi.switchProject(projectId)
	));
	ipcMain.handle(ipcChannels.trackboi.createCard, (_event: IpcMainInvokeEvent, input) => trackboi.createCard(input));
	ipcMain.handle(ipcChannels.trackboi.updateCard, (_event: IpcMainInvokeEvent, cardId: string, patch) => (
		trackboi.updateCard(cardId, patch)
	));
	ipcMain.handle(ipcChannels.trackboi.updateBoard, (_event: IpcMainInvokeEvent, board) => trackboi.updateBoard(board));
	ipcMain.handle(ipcChannels.trackboi.updateCustomFields, (_event: IpcMainInvokeEvent, customFields) => (
		trackboi.updateCustomFields(customFields)
	));
	ipcMain.handle(ipcChannels.trackboi.moveCard, (_event: IpcMainInvokeEvent, input) => (
		trackboi.moveCard(input.cardId, input.toColumn, input.beforeCardId ?? null)
	));
	ipcMain.handle(ipcChannels.trackboi.deleteCard, (_event: IpcMainInvokeEvent, cardId: string) => trackboi.deleteCard(cardId));
}
