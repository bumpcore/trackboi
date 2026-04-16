import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { ProjectSnapshot } from "../shared/types";
import type { TrackboiRPCSchema } from "../shared/rpc";
import {
	activeProjectFromRegistry,
	addProjectToRegistry,
	ensureInitialProject,
	readRegistry,
	setActiveProject,
} from "./core/config";
import {
	createCard,
	deleteCard,
	ensureProject,
	findNearestGitRoot,
	moveCard,
	updateCard,
} from "./core/storage";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
await ensureInitialProject(await findNearestGitRoot(process.cwd()));
let rpc: ReturnType<typeof BrowserView.defineRPC<TrackboiRPCSchema>>;
let mainWindow: BrowserWindow<ReturnType<typeof BrowserView.defineRPC<TrackboiRPCSchema>>>;

async function activeSnapshot(): Promise<ProjectSnapshot | null> {
	const activeProject = activeProjectFromRegistry(await readRegistry());
	if (activeProject == null) return null;
	return ensureProject(activeProject.path);
}

async function broadcastBoardChanged() {
	rpc.send.boardChanged(await activeSnapshot());
}

async function requireActiveProject() {
	const activeProject = activeProjectFromRegistry(await readRegistry());
	if (activeProject == null) {
		throw new Error("Choose a project first");
	}
	return activeProject.path;
}

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

// Create the main application window
const url = await getMainViewUrl();

rpc = BrowserView.defineRPC<TrackboiRPCSchema>({
	maxRequestTime: 10_000,
	handlers: {
		requests: {
			async getActiveProject() {
				return activeSnapshot();
			},
			async listProjects() {
				return readRegistry();
			},
			async chooseProject() {
				const [projectPath] = await Utils.openFileDialog({
					canChooseFiles: false,
					canChooseDirectory: true,
					allowsMultipleSelection: false,
				});

				if (!projectPath) return activeSnapshot();

				const { project } = await addProjectToRegistry(projectPath);
				const snapshot = await ensureProject(project.path);
				rpc.send.boardChanged(snapshot);
				return snapshot;
			},
			async switchProject({ projectId }) {
				const registry = await setActiveProject(projectId);
				const activeProject = activeProjectFromRegistry(registry);
				const snapshot = activeProject ? await ensureProject(activeProject.path) : null;
				rpc.send.boardChanged(snapshot);
				return snapshot;
			},
			async createCard(input) {
				const card = await createCard(await requireActiveProject(), input);
				await broadcastBoardChanged();
				return card;
			},
			async updateCard({ cardId, patch }) {
				const card = await updateCard(await requireActiveProject(), cardId, patch);
				await broadcastBoardChanged();
				return card;
			},
			async moveCard({ cardId, toColumn, beforeCardId }) {
				const card = await moveCard(await requireActiveProject(), cardId, toColumn, beforeCardId);
				await broadcastBoardChanged();
				return card;
			},
			async deleteCard({ cardId }) {
				const result = await deleteCard(await requireActiveProject(), cardId);
				await broadcastBoardChanged();
				return result;
			},
			async minimizeWindow() {
				mainWindow.minimize();
				return { ok: true };
			},
			async toggleMaximizeWindow() {
				if (mainWindow.isMaximized()) {
					mainWindow.unmaximize();
				} else {
					mainWindow.maximize();
				}
				return { ok: true };
			},
			async closeWindow() {
				mainWindow.close();
				return { ok: true };
			},
			async getWindowFrame() {
				return mainWindow.getFrame();
			},
			async setWindowFrame(frame) {
				mainWindow.setFrame(frame.x, frame.y, frame.width, frame.height);
				return { ok: true };
			},
		},
	},
});

mainWindow = new BrowserWindow({
	title: "Trackboi",
	url,
	rpc,
	titleBarStyle: "hidden",
	styleMask: {
		Resizable: true,
		Closable: true,
		Miniaturizable: true,
		Titled: true,
	},
	frame: {
		width: 1180,
		height: 760,
		x: 200,
		y: 200,
	},
});

mainWindow.focus();
console.log("Trackboi started!");
