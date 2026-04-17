import type {
	Board,
	CardPatch,
	CustomField,
	ProjectSnapshot,
	WorkScope,
} from "@/core/types";
import type { TrackboiApi } from "./preload";

type BoardChangedListener = (snapshot: ProjectSnapshot | null) => void;

const listeners = new Set<BoardChangedListener>();
let projectChangeListenerStarted = false;
let projectChangeRefreshQueued = false;

async function notifyBoardChanged() {
	const snapshot = await window.trackboi.getActiveProject();
	for (const listener of listeners) listener(snapshot);
	return snapshot;
}

function startProjectChangeListener() {
	if (projectChangeListenerStarted) return;
	projectChangeListenerStarted = true;

	window.trackboi.onProjectChanged(() => {
		if (projectChangeRefreshQueued) return;
		projectChangeRefreshQueued = true;
		window.setTimeout(() => {
			projectChangeRefreshQueued = false;
			void notifyBoardChanged();
		}, 120);
	});
}

export const desktop = {
	async getActiveProject() {
		return window.trackboi.getActiveProject();
	},
	async listProjects() {
		return window.trackboi.listProjects();
	},
	async listView() {
		return window.trackboi.listView();
	},
	async setStorageSearchPaths(paths: string[]) {
		return window.trackboi.setStorageSearchPaths(paths);
	},
	async setActiveWorkspaceFile(filePath: string | null) {
		return window.trackboi.setActiveWorkspaceFile(filePath);
	},
	async openWorkspaceFile() {
		return window.trackboi.openWorkspaceFile();
	},
	async chooseProject() {
		const snapshot = await window.trackboi.chooseProject();
		for (const listener of listeners) listener(snapshot);
		return snapshot;
	},
	async locateProject(projectId: string) {
		const snapshot = await window.trackboi.locateProject(projectId);
		for (const listener of listeners) listener(snapshot);
		return snapshot;
	},
	async removeProject(projectId: string) {
		const snapshot = await window.trackboi.removeProject(projectId);
		for (const listener of listeners) listener(snapshot);
		return snapshot;
	},
	async switchProject(projectId: string) {
		const snapshot = await window.trackboi.switchProject(projectId);
		for (const listener of listeners) listener(snapshot);
		return snapshot;
	},
	async createCard(input: {
		title: string;
		description?: string;
		parentId?: string | null;
		column: string;
		scope?: WorkScope;
	}) {
		const card = await window.trackboi.createCard(input);
		await notifyBoardChanged();
		return card;
	},
	async updateCard(cardId: string, patch: CardPatch) {
		const card = await window.trackboi.updateCard(cardId, patch);
		await notifyBoardChanged();
		return card;
	},
	async updateBoard(board: Board) {
		const nextBoard = await window.trackboi.updateBoard(board);
		await notifyBoardChanged();
		return nextBoard;
	},
	async updateCustomFields(customFields: CustomField[]) {
		const metadata = await window.trackboi.updateCustomFields(customFields);
		await notifyBoardChanged();
		return metadata;
	},
	async moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
		const card = await window.trackboi.moveCard(cardId, toColumn, beforeCardId);
		await notifyBoardChanged();
		return card;
	},
	async deleteCard(cardId: string) {
		const result = await window.trackboi.deleteCard(cardId);
		await notifyBoardChanged();
		return result;
	},
	async minimizeWindow() {
		await window.trackboi.window.minimize();
		return { ok: true as const };
	},
	async toggleMaximizeWindow() {
		await window.trackboi.window.toggleMaximize();
		return { ok: true as const };
	},
	async closeWindow() {
		await window.trackboi.window.close();
		return { ok: true as const };
	},
	async startWindowDrag() {
		await window.trackboi.window.startDrag();
	},
	async startResize(edge: string) {
		await window.trackboi.window.startResize(edge);
	},
	addBoardChangedListener(listener: BoardChangedListener) {
		startProjectChangeListener();
		listeners.add(listener);
	},
};

declare global {
	interface Window {
		trackboi: TrackboiApi;
	}
}
