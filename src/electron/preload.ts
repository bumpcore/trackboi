import { contextBridge, ipcRenderer } from "electron";
import type {
	Board,
	Card,
	CardPatch,
	CreateCardInput,
	CustomField,
	MoveCardInput,
	ProjectMetadata,
	ProjectRegistry,
	ProjectSnapshot,
	ProjectView,
} from "../core";

export type ProjectChangedPayload = {
	rootPath: string;
};

export type TrackboiApi = {
	getActiveProject(): Promise<ProjectSnapshot | null>;
	listProjects(): Promise<ProjectRegistry>;
	listView(): Promise<ProjectView>;
	setStorageSearchPaths(paths: string[]): Promise<ProjectView>;
	setActiveWorkspaceFile(filePath: string | null): Promise<ProjectView>;
	openWorkspaceFile(): Promise<ProjectView | null>;
	chooseProject(): Promise<ProjectSnapshot | null>;
	locateProject(projectId: string): Promise<ProjectSnapshot | null>;
	removeProject(projectId: string): Promise<ProjectSnapshot | null>;
	switchProject(projectId: string): Promise<ProjectSnapshot | null>;
	createCard(input: CreateCardInput): Promise<Card>;
	updateCard(cardId: string, patch: CardPatch): Promise<Card>;
	updateBoard(board: Board): Promise<Board>;
	updateCustomFields(customFields: CustomField[]): Promise<ProjectMetadata>;
	moveCard(cardId: string, toColumn: string, beforeCardId: string | null): Promise<Card>;
	deleteCard(cardId: string): Promise<{ ok: true }>;
	onProjectChanged(listener: (payload: ProjectChangedPayload) => void): () => void;
	window: {
		minimize(): Promise<void>;
		toggleMaximize(): Promise<void>;
		close(): Promise<void>;
		startDrag(): Promise<void>;
		startResize(edge: string): Promise<void>;
	};
};

/**
 * The only API exposed from Electron preload into the renderer.
 *
 * Keeping this object typed and narrow prevents UI code from reaching Node or
 * Electron directly.
 */
const api: TrackboiApi = {
	getActiveProject: () => ipcRenderer.invoke("trackboi:get-active-project") as Promise<ProjectSnapshot | null>,
	listProjects: () => ipcRenderer.invoke("trackboi:list-projects") as Promise<ProjectRegistry>,
	listView: () => ipcRenderer.invoke("trackboi:list-view") as Promise<ProjectView>,
	setStorageSearchPaths: (paths) => (
		ipcRenderer.invoke("trackboi:set-storage-search-paths", paths) as Promise<ProjectView>
	),
	setActiveWorkspaceFile: (filePath) => (
		ipcRenderer.invoke("trackboi:set-active-workspace-file", filePath) as Promise<ProjectView>
	),
	openWorkspaceFile: () => ipcRenderer.invoke("trackboi:open-workspace-file") as Promise<ProjectView | null>,
	chooseProject: () => ipcRenderer.invoke("trackboi:choose-project") as Promise<ProjectSnapshot | null>,
	locateProject: (projectId) => (
		ipcRenderer.invoke("trackboi:locate-project", projectId) as Promise<ProjectSnapshot | null>
	),
	removeProject: (projectId) => (
		ipcRenderer.invoke("trackboi:remove-project", projectId) as Promise<ProjectSnapshot | null>
	),
	switchProject: (projectId) => (
		ipcRenderer.invoke("trackboi:switch-project", projectId) as Promise<ProjectSnapshot | null>
	),
	createCard: (input) => ipcRenderer.invoke("trackboi:create-card", input) as Promise<Card>,
	updateCard: (cardId, patch) => (
		ipcRenderer.invoke("trackboi:update-card", cardId, patch) as Promise<Card>
	),
	updateBoard: (board) => ipcRenderer.invoke("trackboi:update-board", board) as Promise<Board>,
	updateCustomFields: (customFields) => (
		ipcRenderer.invoke("trackboi:update-custom-fields", customFields) as Promise<ProjectMetadata>
	),
	moveCard: (cardId, toColumn, beforeCardId) => (
		ipcRenderer.invoke("trackboi:move-card", { cardId, toColumn, beforeCardId } satisfies MoveCardInput) as Promise<Card>
	),
	deleteCard: (cardId) => ipcRenderer.invoke("trackboi:delete-card", cardId) as Promise<{ ok: true }>,
	onProjectChanged: (listener) => {
		const wrapped = (_event: Electron.IpcRendererEvent, payload: ProjectChangedPayload) => listener(payload);
		ipcRenderer.on("trackboi://project-changed", wrapped);
		return () => ipcRenderer.off("trackboi://project-changed", wrapped);
	},
	window: {
		minimize: () => ipcRenderer.invoke("trackboi:window-minimize") as Promise<void>,
		toggleMaximize: () => ipcRenderer.invoke("trackboi:window-toggle-maximize") as Promise<void>,
		close: () => ipcRenderer.invoke("trackboi:window-close") as Promise<void>,
		startDrag: () => ipcRenderer.invoke("trackboi:window-start-drag") as Promise<void>,
		startResize: (edge) => ipcRenderer.invoke("trackboi:window-start-resize", edge) as Promise<void>,
	},
};

contextBridge.exposeInMainWorld("trackboi", api);
