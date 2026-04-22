import { app, BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import { findCliArgs, runCli } from "../cli/main";
import { createNodeFsTrackboiActions } from "../core";
import { createAppWindow } from "./main/createWindow";
import { buildDesktopStorePatches } from "./main/desktopStorePatches";
import { listDetectedEditors, openCardInEditor } from "./main/editorIntegration";
import { createProjectStorageWatcher } from "./main/storageWatcher";
import { registerTrackboiIpcHandlers } from "./main/trackboiIpc";
import { registerWindowIpcHandlers } from "./main/windowIpc";
import { ipcChannels } from "./ipc";
import type { DesktopState, ProjectView } from "../core";

app.setName("Trackboi");

let mainWindow: BrowserWindow | null = null;
let latestDesktopState: DesktopState | null = null;
const trackboi = createNodeFsTrackboiActions({
	dialogs: {
		chooseProjectDirectory: chooseDirectory,
		chooseWorkspaceFile,
	},
});
const storageWatcher = createProjectStorageWatcher({
	paths: {
		boardsPath: trackboi.paths.boardsPath,
		cardsPath: trackboi.paths.cardsPath,
		cardDirPath: trackboi.paths.cardDirPath,
		cardCommentsPath: trackboi.paths.cardCommentsPath,
		tracksPath: trackboi.paths.tracksPath,
		trackFilesPath: trackboi.paths.trackFilesPath,
	},
	onProjectChanged(rootPath) {
		const previousState = latestDesktopState;
		trackboi.invalidateStorageRoot(rootPath);
		void readDesktopState().then((state) => {
			for (const patch of buildDesktopStorePatches(previousState, state)) {
				mainWindow?.webContents.send(ipcChannels.events.desktopStorePatch, patch);
			}
		});
	},
});

const cliArgs = findCliArgs(process.argv);
if (cliArgs.length > 0) {
	void runCli(trackboi, cliArgs)
		.then((code) => app.exit(code))
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			app.exit(1);
		});
} else {
	void app.whenReady().then(() => {
		registerIpc();
		createWindow();
		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) createWindow();
		});
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") app.quit();
	});
}

async function getActiveProject() {
	const snapshot = await trackboi.getActiveProject();
	const desktopState = await readDesktopState();
	storageWatcher.refresh(desktopState.worktrees
		.map((worktree) => worktree.storageRoot)
		.filter((rootPath): rootPath is string => typeof rootPath === "string" && rootPath.length > 0));
	return snapshot;
}

async function readDesktopState() {
	const desktopState = await trackboi.readDesktopState();
	latestDesktopState = desktopState;
	storageWatcher.refresh(desktopState.worktrees
		.map((worktree) => worktree.storageRoot)
		.filter((rootPath): rootPath is string => typeof rootPath === "string" && rootPath.length > 0));
	return desktopState;
}

function rememberDesktopState(state: DesktopState): void {
	latestDesktopState = state;
	storageWatcher.refresh(state.worktrees
		.map((worktree) => worktree.storageRoot)
		.filter((rootPath): rootPath is string => typeof rootPath === "string" && rootPath.length > 0));
}

function rememberProjectView(view: ProjectView): void {
	if (!latestDesktopState) return;
	latestDesktopState = {
		...latestDesktopState,
		view,
	};
}

async function chooseDirectory(): Promise<string | null> {
	const result = mainWindow
		? await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] })
		: await dialog.showOpenDialog({ properties: ["openDirectory"] });
	return result.canceled ? null : result.filePaths[0] ?? null;
}

async function chooseWorkspaceFile(): Promise<string | null> {
	const options: OpenDialogOptions = {
		properties: ["openFile"],
		filters: [{ name: "Code Workspace", extensions: ["code-workspace"] }],
	};
	const result = mainWindow
		? await dialog.showOpenDialog(mainWindow, options)
		: await dialog.showOpenDialog(options);
	return result.canceled ? null : result.filePaths[0] ?? null;
}

function registerIpc(): void {
	registerWindowIpcHandlers();
	registerTrackboiIpcHandlers({
		trackboi,
		getActiveProject,
		readDesktopState,
		rememberDesktopState,
		rememberProjectView,
		listDetectedEditors,
		openCardInEditor: (cardId) => openCardInEditor(trackboi, cardId),
	});
}

function createWindow(): void {
	mainWindow = createAppWindow();
}
