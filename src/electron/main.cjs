const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRuntime } = require("../core/runtime.cjs");
const { runCli, findCliArgs } = require("../cli/main.cjs");

app.setName("Trackboi");

const runtime = createRuntime({
	configPath: path.join(app.getPath("userData"), "config.json"),
	legacyConfigPaths: [
		path.join(os.homedir(), ".config", "dev.bumpcore.trackboi", "config.json"),
		path.join(os.homedir(), ".config", "trackboi", "config.json"),
	],
});

let mainWindow = null;
let activeWatchers = [];
let watcherTimer = null;

const cliArgs = findCliArgs(process.argv);
if (cliArgs.length > 0) {
	runCli(runtime, cliArgs)
		.then((code) => app.exit(code))
		.catch((error) => {
			console.error(error instanceof Error ? error.message : String(error));
			app.exit(1);
		});
} else {
	app.whenReady().then(() => {
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

function publicSnapshot(snapshot) {
	if (!snapshot) return snapshot;
	const { storageRoot: _storageRoot, ...rest } = snapshot;
	return rest;
}

function getActiveProject() {
	const snapshot = runtime.activeSnapshotWithInternals();
	if (snapshot?.storageRoot) refreshStorageWatcher(snapshot.storageRoot);
	return publicSnapshot(snapshot);
}

function refreshStorageWatcher(rootPath) {
	for (const watcher of activeWatchers) watcher.close();
	activeWatchers = [];
	for (const targetPath of [
		rootPath,
		runtime.paths.boardsPath(rootPath),
		runtime.paths.cardsPath(rootPath),
	]) {
		if (!fs.existsSync(targetPath)) continue;
		activeWatchers.push(fs.watch(targetPath, () => {
			clearTimeout(watcherTimer);
			watcherTimer = setTimeout(() => {
				mainWindow?.webContents.send("trackboi://project-changed", { rootPath });
			}, 120);
		}));
	}
}

async function chooseDirectory() {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openDirectory"],
	});
	return result.canceled ? null : result.filePaths[0];
}

async function chooseWorkspaceFile() {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openFile"],
		filters: [{ name: "Code Workspace", extensions: ["code-workspace"] }],
	});
	return result.canceled ? null : result.filePaths[0];
}

function registerIpc() {
	ipcMain.handle("trackboi:window-minimize", (event) => {
		BrowserWindow.fromWebContents(event.sender)?.minimize();
	});
	ipcMain.handle("trackboi:window-toggle-maximize", (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return;
		if (window.isMaximized()) window.unmaximize();
		else window.maximize();
	});
	ipcMain.handle("trackboi:window-close", (event) => {
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
	ipcMain.handle("trackboi:set-storage-search-paths", (_event, paths) => (
		runtime.setStorageSearchPaths(paths)
	));
	ipcMain.handle("trackboi:set-active-workspace-file", (_event, filePath) => (
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
	ipcMain.handle("trackboi:locate-project", async (_event, projectId) => {
		const selected = await chooseDirectory();
		if (!selected) return getActiveProject();
		runtime.locateProjectPath(projectId, selected);
		return getActiveProject();
	});
	ipcMain.handle("trackboi:remove-project", (_event, projectId) => {
		runtime.removeProject(projectId);
		return getActiveProject();
	});
	ipcMain.handle("trackboi:switch-project", (_event, projectId) => {
		runtime.switchProject(projectId);
		return getActiveProject();
	});
	ipcMain.handle("trackboi:create-card", (_event, input) => runtime.createCard(input));
	ipcMain.handle("trackboi:update-card", (_event, cardId, patch) => (
		runtime.updateCard(cardId, patch)
	));
	ipcMain.handle("trackboi:update-board", (_event, board) => runtime.updateBoard(board));
	ipcMain.handle("trackboi:update-custom-fields", (_event, customFields) => (
		runtime.updateCustomFields(customFields)
	));
	ipcMain.handle("trackboi:move-card", (_event, input) => runtime.moveCard(input));
	ipcMain.handle("trackboi:delete-card", (_event, cardId) => runtime.deleteCard(cardId));
}

function createWindow() {
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
		mainWindow.loadURL(process.env.TRACKBOI_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
	}
}
