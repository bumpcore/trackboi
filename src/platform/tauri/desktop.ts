import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { Board, Card, CardPatch, CustomField, ProjectIndex, ProjectMetadata, ProjectRegistry, ProjectSnapshot, WorkScope } from "@/core/types";

type BoardChangedListener = (snapshot: ProjectSnapshot | null) => void;
type ResizeDirection = "East" | "North" | "NorthEast" | "NorthWest" | "South" | "SouthEast" | "SouthWest" | "West";

const listeners = new Set<BoardChangedListener>();

async function notifyBoardChanged() {
	const snapshot = await invoke<ProjectSnapshot | null>("get_active_project");
	for (const listener of listeners) listener(snapshot);
	return snapshot;
}

function toResizeDirection(edge: string): ResizeDirection {
	const map: Record<string, ResizeDirection> = {
		n: "North",
		e: "East",
		s: "South",
		w: "West",
		ne: "NorthEast",
		nw: "NorthWest",
		se: "SouthEast",
		sw: "SouthWest",
	};
	return map[edge];
}

const tauriWindow = () => getCurrentWindow();

export const desktop = {
	async getActiveProject() {
		return invoke<ProjectSnapshot | null>("get_active_project");
	},
	async listProjects() {
		return invoke<ProjectRegistry>("list_projects");
	},
	async listProjectIndex() {
		return invoke<ProjectIndex>("list_project_index");
	},
	async setStorageSearchPaths(paths: string[]) {
		return invoke<ProjectIndex>("set_storage_search_paths", { paths });
	},
	async chooseProject() {
		const selected = await openDialog({ directory: true, multiple: false });
		if (typeof selected !== "string") return this.getActiveProject();
		const snapshot = await invoke<ProjectSnapshot | null>("choose_project", { projectPath: selected });
		for (const listener of listeners) listener(snapshot);
		return snapshot;
	},
	async locateProject(projectId: string) {
		const selected = await openDialog({ directory: true, multiple: false });
		if (typeof selected !== "string") return this.getActiveProject();
		const snapshot = await invoke<ProjectSnapshot | null>("locate_project", { projectId, projectPath: selected });
		for (const listener of listeners) listener(snapshot);
		return snapshot;
	},
	async removeProject(projectId: string) {
		const snapshot = await invoke<ProjectSnapshot | null>("remove_project", { projectId });
		for (const listener of listeners) listener(snapshot);
		return snapshot;
	},
	async switchProject(projectId: string) {
		const snapshot = await invoke<ProjectSnapshot | null>("switch_project", { projectId });
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
		const card = await invoke<Card>("create_card", { input });
		await notifyBoardChanged();
		return card;
	},
	async updateCard(cardId: string, patch: CardPatch) {
		const card = await invoke<Card>("update_card", { cardId, patch });
		await notifyBoardChanged();
		return card;
	},
	async updateBoard(board: Board) {
		const nextBoard = await invoke<Board>("update_board", { board });
		await notifyBoardChanged();
		return nextBoard;
	},
	async updateCustomFields(customFields: CustomField[]) {
		const metadata = await invoke<ProjectMetadata>("update_custom_fields", { customFields });
		await notifyBoardChanged();
		return metadata;
	},
	async moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
		const card = await invoke<Card>("move_card", { input: { cardId, toColumn, beforeCardId } });
		await notifyBoardChanged();
		return card;
	},
	async deleteCard(cardId: string) {
		const result = await invoke<{ ok: true }>("delete_card", { cardId });
		await notifyBoardChanged();
		return result;
	},
	async minimizeWindow() {
		await tauriWindow().minimize();
		return { ok: true as const };
	},
	async toggleMaximizeWindow() {
		const window = tauriWindow();
		if (await window.isMaximized()) await window.unmaximize();
		else await window.maximize();
		return { ok: true as const };
	},
	async closeWindow() {
		await tauriWindow().close();
		return { ok: true as const };
	},
	async startWindowDrag() {
		const window = tauriWindow();
		if (await window.isMaximized()) {
			await window.unmaximize();
		}
		await window.setFocus();
		await window.startDragging();
	},
	async startResize(edge: string) {
		const window = tauriWindow();
		await window.setFocus();
		await window.startResizeDragging(toResizeDirection(edge));
	},
	addBoardChangedListener(listener: BoardChangedListener) {
		listeners.add(listener);
	},
};
