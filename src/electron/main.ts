import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent, type OpenDialogOptions } from "electron";
import { existsSync, type FSWatcher, watch } from "node:fs";
import path from "node:path";
import { findCliArgs, runCli } from "../cli/main";
import { createRuntime, stripInternalSnapshotFields } from "../core/runtime";
import type { Board, CardPatch, CustomField } from "../core";

app.setName("Trackboi");

const runtime = createRuntime();

let mainWindow: BrowserWindow | null = null;
let activeWatchers: FSWatcher[] = [];
let watcherTimer: ReturnType<typeof setTimeout> | null = null;

const cliArgs = findCliArgs(process.argv);
if (cliArgs.length > 0) {
	void runCli(runtime, cliArgs)
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

function getActiveProject() {
	const snapshot = runtime.activeSnapshotWithInternals();
	const desktopState = runtime.readDesktopState();
	refreshStorageWatcher(desktopState.worktrees
		.map((worktree) => worktree.storageRoot)
		.filter((rootPath): rootPath is string => typeof rootPath === "string" && rootPath.length > 0));
	return stripInternalSnapshotFields(snapshot);
}

function refreshStorageWatcher(rootPaths: string[]): void {
	for (const watcher of activeWatchers) watcher.close();
	activeWatchers = [];
	for (const rootPath of rootPaths) {
		for (const targetPath of [
			rootPath,
			runtime.paths.boardsPath(rootPath),
			runtime.paths.cardsPath(rootPath),
		]) {
			if (!existsSync(targetPath)) continue;
			activeWatchers.push(watch(targetPath, () => {
				if (watcherTimer) clearTimeout(watcherTimer);
				watcherTimer = setTimeout(() => {
					runtime.invalidateCache();
					mainWindow?.webContents.send("trackboi://project-changed", { rootPath });
				}, 120);
			}));
		}
	}
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
	ipcMain.handle("trackboi:window-minimize", (event: IpcMainInvokeEvent) => {
		BrowserWindow.fromWebContents(event.sender)?.minimize();
	});
	ipcMain.handle("trackboi:window-toggle-maximize", (event: IpcMainInvokeEvent) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return;
		if (window.isMaximized()) window.unmaximize();
		else window.maximize();
	});
	ipcMain.handle("trackboi:window-close", (event: IpcMainInvokeEvent) => {
		BrowserWindow.fromWebContents(event.sender)?.close();
	});
	ipcMain.handle("trackboi:window-start-drag", () => {
		// Electron frameless dragging is handled by CSS app regions in the renderer.
	});
	ipcMain.handle("trackboi:window-start-resize", () => {
		// Native edge resize remains available; no JS resize loop needed.
	});

	ipcMain.handle("trackboi:get-active-project", () => getActiveProject());
	ipcMain.handle("trackboi:list-projects", () => runtime.readRegistry());
	ipcMain.handle("trackboi:list-view", () => runtime.listView());
	ipcMain.handle("trackboi:read-desktop-state", () => runtime.readDesktopState());
	ipcMain.handle("trackboi:set-selected-worktree", (_event: IpcMainInvokeEvent, worktreeId: string | null) => (
		runtime.setSelectedWorktree(worktreeId)
	));
	ipcMain.handle("trackboi:set-storage-search-paths", (_event: IpcMainInvokeEvent, paths: string[]) => (
		runtime.setStorageSearchPaths(paths)
	));
	ipcMain.handle("trackboi:set-active-workspace-file", (_event: IpcMainInvokeEvent, filePath: string | null) => (
		runtime.setActiveWorkspaceFile(filePath)
	));
	ipcMain.handle("trackboi:open-workspace-file", async () => {
		const filePath = await chooseWorkspaceFile();
		if (!filePath) return null;
		return runtime.setActiveWorkspaceFile(filePath);
	});
	ipcMain.handle("trackboi:choose-project", async () => {
		const selected = await chooseDirectory();
		if (!selected) return getActiveProject();
		runtime.chooseProjectPath(selected);
		return getActiveProject();
	});
	ipcMain.handle("trackboi:locate-project", async (_event: IpcMainInvokeEvent, projectId: string) => {
		const selected = await chooseDirectory();
		if (!selected) return getActiveProject();
		runtime.locateProjectPath(projectId, selected);
		return getActiveProject();
	});
	ipcMain.handle("trackboi:remove-project", (_event: IpcMainInvokeEvent, projectId: string) => {
		runtime.removeProject(projectId);
		return getActiveProject();
	});
	ipcMain.handle("trackboi:switch-project", (_event: IpcMainInvokeEvent, projectId: string) => {
		runtime.switchProject(projectId);
		return runtime.readDesktopState();
	});
	ipcMain.handle("trackboi:create-card", (_event: IpcMainInvokeEvent, input: Parameters<typeof runtime.createCard>[0]) => (
		runtime.createCard(input)
	));
	ipcMain.handle("trackboi:update-card", (_event: IpcMainInvokeEvent, cardId: string, patch: CardPatch) => (
		runtime.updateCard(cardId, patch)
	));
	ipcMain.handle("trackboi:update-board", (_event: IpcMainInvokeEvent, board: Board) => runtime.updateBoard(board));
	ipcMain.handle("trackboi:update-custom-fields", (_event: IpcMainInvokeEvent, customFields: CustomField[]) => (
		runtime.updateCustomFields(customFields)
	));
	ipcMain.handle("trackboi:move-card", (_event: IpcMainInvokeEvent, input: Parameters<typeof runtime.moveCard>[0]) => (
		runtime.moveCard(input)
	));
	ipcMain.handle("trackboi:delete-card", (_event: IpcMainInvokeEvent, cardId: string) => runtime.deleteCard(cardId));
}

function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1180,
		height: 760,
		minWidth: 760,
		minHeight: 480,
		frame: false,
		title: "Trackboi",
		backgroundColor: "#090909",
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	if (process.env.TRACKBOI_DEV_SERVER_URL) {
		void mainWindow.loadURL(process.env.TRACKBOI_DEV_SERVER_URL);
	} else {
		void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
	}
}
