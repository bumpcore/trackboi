import { app, BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import { findCliArgs, runCli } from "../cli/main";
import { createNodeFsTrackboiActions } from "../core";
import { createAppWindow } from "./main/createWindow";
import { createProjectStorageWatcher } from "./main/storageWatcher";
import { registerTrackboiIpcHandlers } from "./main/trackboiIpc";
import { registerWindowIpcHandlers } from "./main/windowIpc";
import { ipcChannels } from "./ipc";

app.setName("Trackboi");

let mainWindow: BrowserWindow | null = null;
const trackboi = createNodeFsTrackboiActions({
	dialogs: {
		chooseProjectDirectory: chooseDirectory,
		chooseWorkspaceFile,
	},
});
const storageWatcher = createProjectStorageWatcher({
	paths: trackboi.paths,
	onProjectChanged(rootPath) {
		trackboi.invalidateCache();
		mainWindow?.webContents.send(ipcChannels.events.projectChanged, { rootPath });
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
	const desktopState = await trackboi.readDesktopState();
	storageWatcher.refresh(desktopState.worktrees
		.map((worktree) => worktree.storageRoot)
		.filter((rootPath): rootPath is string => typeof rootPath === "string" && rootPath.length > 0));
	return snapshot;
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
	registerTrackboiIpcHandlers({ trackboi, getActiveProject });
}

function createWindow(): void {
	mainWindow = createAppWindow();
}
