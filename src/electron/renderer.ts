import type {
	AppSettings,
	Board,
	CardPatch,
	CreateCardCommentInput,
	CreateTrackInput,
	CustomField,
	DesktopState,
	GitCommitInput,
	PersonAlias,
	ProjectSettingsPatch,
	TrackDecision,
	TrackPatch,
	TrackReference,
	TrackFileWriteInput,
} from "@/core/types";
import type { DesktopStorePatch, TrackboiBridgeApi, WindowBridgeApi } from "./bridge";
import { trackboi } from "./trackboi";
import { windowShell } from "./window";

type DesktopStorePatchListener = (patch: DesktopStorePatch) => void;

function serializeCustomField(field: CustomField): CustomField {
	return field.options
		? { ...field, options: [...field.options] }
		: { ...field };
}

function serializeCreateCardInput(input: {
	boardId?: string;
	title: string;
	description?: string;
	parentId?: string | null;
	column: string;
	trackId?: string | null;
	actorId?: string;
}) {
	return {
		boardId: input.boardId,
		title: input.title,
		description: input.description,
		parentId: input.parentId,
		column: input.column,
		trackId: input.trackId,
		actorId: input.actorId,
	};
}

function serializeCardPatch(patch: CardPatch): CardPatch {
	return {
		boardId: patch.boardId,
		title: patch.title,
		description: patch.description,
		parentId: patch.parentId,
		trackId: patch.trackId,
		column: patch.column,
		rank: patch.rank,
		labels: patch.labels ? [...patch.labels] : undefined,
		assignee: patch.assignee,
		fieldValues: patch.fieldValues ? { ...patch.fieldValues } : undefined,
		archivedAt: patch.archivedAt,
		actorId: patch.actorId,
	};
}

function serializeCreateCardCommentInput(input: CreateCardCommentInput): CreateCardCommentInput {
	return {
		cardId: input.cardId,
		body: input.body,
		actorId: input.actorId,
	};
}

function serializeTrackDecision(decision: TrackDecision): TrackDecision {
	return {
		id: decision.id,
		title: decision.title,
		body: decision.body,
		status: decision.status,
		createdAt: decision.createdAt,
		updatedAt: decision.updatedAt,
	};
}

function serializeTrackReference(reference: TrackReference): TrackReference {
	return {
		id: reference.id,
		kind: reference.kind,
		label: reference.label,
		value: reference.value,
	};
}

function serializeCreateTrackInput(input: CreateTrackInput): CreateTrackInput {
	return {
		title: input.title,
		summary: input.summary,
		brief: input.brief,
		actorId: input.actorId,
	};
}

function serializeTrackPatch(patch: TrackPatch): TrackPatch {
	return {
		title: patch.title,
		summary: patch.summary,
		brief: patch.brief,
		decisions: patch.decisions ? patch.decisions.map(serializeTrackDecision) : undefined,
		references: patch.references ? patch.references.map(serializeTrackReference) : undefined,
		actorId: patch.actorId,
	};
}

function serializeAppSettings(settings: AppSettings): AppSettings {
	const userIdentity = settings.userIdentity ?? { displayName: "", gitName: "", gitEmail: "" };
	const onboarding = settings.onboarding ?? { userComplete: false, firstProjectComplete: false };
	const shortcuts = settings.shortcuts ?? {
		leftPanel: "Ctrl+B",
		rightPanel: "Ctrl+Shift+X",
		commandCenterNavigate: "Ctrl+P",
		commandCenterCommand: "Ctrl+Shift+P",
		openSettings: "Ctrl+,",
		addProject: "Ctrl+O",
		newCard: "Ctrl+N",
		newTrack: "Ctrl+Shift+N",
		nextProject: "Ctrl+PageDown",
		previousProject: "Ctrl+PageUp",
		projectSettings: "Ctrl+Alt+,",
		boardSettings: "Ctrl+Alt+B",
		focusBoard: "Ctrl+Alt+0",
	};
	return {
		version: settings.version,
		agents: settings.agents.map((agent) => ({
			id: agent.id,
			name: agent.name,
			description: agent.description,
		})),
		agentContexts: settings.agentContexts.map((context) => ({
			agentId: context.agentId,
			projectPath: context.projectPath,
			worktreeId: context.worktreeId,
			boardId: context.boardId,
		})),
		editor: {
			preferredEditorId: settings.editor.preferredEditorId,
			customCommand: settings.editor.customCommand,
		},
		userIdentity: {
			displayName: userIdentity.displayName,
			gitName: userIdentity.gitName,
			gitEmail: userIdentity.gitEmail,
		},
		onboarding: {
			userComplete: onboarding.userComplete,
			firstProjectComplete: onboarding.firstProjectComplete,
		},
		shortcuts: { ...shortcuts },
	};
}

/**
 * Electron IPC expects plain cloneable data. Board settings often originate
 * from Vue-managed snapshots, so flatten them before crossing the bridge.
 */
function serializeBoard(board: Board): Board {
	return {
		id: board.id,
		version: board.version,
		name: board.name,
		columns: board.columns.map((column) => ({ ...column })),
		customFields: board.customFields.map(serializeCustomField),
	};
}

/**
 * Creates the renderer-side desktop facade by composing the IPC-backed Trackboi
 * actions transport with the dedicated shell window transport.
 */
export function createDesktopFacade(
	trackboiApi: TrackboiBridgeApi = trackboi,
	windowApi: WindowBridgeApi = windowShell,
) {
	let projectPrewarmQueued = false;
	let projectPrewarmInFlight = false;

	/**
	 * Hydrates non-active project caches after the current interaction settles so
	 * later project switches can reuse warm snapshot/worktree state.
	 */
	function scheduleProjectPrewarm(delayMs = 140): void {
		if (projectPrewarmQueued || projectPrewarmInFlight) return;
		projectPrewarmQueued = true;
		globalThis.setTimeout(() => {
			projectPrewarmQueued = false;
			if (projectPrewarmInFlight) return;
			projectPrewarmInFlight = true;
			void trackboiApi.prewarmProjects()
				.catch(() => undefined)
				.finally(() => {
					projectPrewarmInFlight = false;
				});
		}, delayMs);
	}

	async function refreshAfterProjectSelection<T>(action: () => Promise<T>): Promise<T> {
		const result = await action();
		scheduleProjectPrewarm();
		return result;
	}

	return {
	async getActiveProject() {
		return trackboiApi.getActiveProject();
	},
	async listProjects() {
		return trackboiApi.listProjects();
	},
	async listView() {
		return trackboiApi.listView();
	},
	async readDesktopState(): Promise<DesktopState> {
		const nextState = await trackboiApi.readDesktopState();
		scheduleProjectPrewarm();
		return nextState;
	},
	async setSelectedWorktree(worktreeId: string | null): Promise<DesktopState> {
		const nextState = await trackboiApi.setSelectedWorktree(worktreeId);
		scheduleProjectPrewarm();
		return nextState;
	},
	async listBoards() {
		return trackboiApi.listBoards();
	},
	async setActiveBoard(boardId: string): Promise<DesktopState> {
		return trackboiApi.setActiveBoard(boardId);
	},
	async readAppSettings() {
		return trackboiApi.readAppSettings();
	},
	async updateAppSettings(settings: AppSettings) {
		return trackboiApi.updateAppSettings(serializeAppSettings(settings));
	},
	async listGitChanges(paths?: string[]) {
		return trackboiApi.listGitChanges(paths);
	},
	async commitGitChanges(input: GitCommitInput) {
		const result = await trackboiApi.commitGitChanges({
			message: input.message,
			paths: input.paths ? [...input.paths] : undefined,
		});
		scheduleProjectPrewarm();
		return result;
	},
	async listDetectedEditors() {
		return trackboiApi.listDetectedEditors();
	},
	async openCardInEditor(cardId: string) {
		return trackboiApi.openCardInEditor(cardId);
	},
	async setStorageSearchPaths(paths: string[]) {
		return trackboiApi.setStorageSearchPaths(paths);
	},
	async setActiveWorkspaceFile(filePath: string | null) {
		return trackboiApi.setActiveWorkspaceFile(filePath);
	},
	async createBoard(input: { name: string }) {
		return trackboiApi.createBoard(input);
	},
	async deleteBoard(boardId: string) {
		return trackboiApi.deleteBoard(boardId);
	},
	async listTracks() {
		return trackboiApi.listTracks();
	},
	async getTrack(trackId: string) {
		return trackboiApi.getTrack(trackId);
	},
	async createTrack(input: CreateTrackInput) {
		return trackboiApi.createTrack(serializeCreateTrackInput(input));
	},
	async updateTrack(trackId: string, patch: TrackPatch) {
		return trackboiApi.updateTrack(trackId, serializeTrackPatch(patch));
	},
	async deleteTrack(trackId: string) {
		return trackboiApi.deleteTrack(trackId);
	},
	async readTrackFile(trackId: string, fileName: string) {
		return trackboiApi.readTrackFile(trackId, fileName);
	},
	async writeTrackFile(input: TrackFileWriteInput) {
		return trackboiApi.writeTrackFile(input);
	},
	async deleteTrackFile(trackId: string, fileName: string) {
		return trackboiApi.deleteTrackFile(trackId, fileName);
	},
	async openWorkspaceFile() {
		return trackboiApi.openWorkspaceFile();
	},
	async chooseProjectIconFile() {
		return trackboiApi.chooseProjectIconFile();
	},
	async chooseProject() {
		return refreshAfterProjectSelection(() => trackboiApi.chooseProject());
	},
	async locateProject(projectPath: string) {
		return refreshAfterProjectSelection(() => trackboiApi.locateProject(projectPath));
	},
	async removeProject(projectPath: string) {
		return refreshAfterProjectSelection(() => trackboiApi.removeProject(projectPath));
	},
	async switchProject(projectPath: string) {
		return refreshAfterProjectSelection(() => trackboiApi.switchProject(projectPath));
	},
	async createCard(input: {
		boardId?: string;
		title: string;
		description?: string;
		parentId?: string | null;
		column: string;
		trackId?: string | null;
	}) {
		return trackboiApi.createCard(serializeCreateCardInput(input));
	},
	async updateCard(cardId: string, patch: CardPatch) {
		return trackboiApi.updateCard(cardId, serializeCardPatch(patch));
	},
	async updateBoard(board: Board) {
		return trackboiApi.updateBoard(serializeBoard(board));
	},
	async updateProjectSettings(patch: ProjectSettingsPatch) {
		return trackboiApi.updateProjectSettings({
			color: patch.color ?? null,
			iconPath: patch.iconPath ?? null,
		});
	},
	async updateProjectPeople(people: PersonAlias[]) {
		return trackboiApi.updateProjectPeople(people.map((person) => ({
			id: person.id,
			displayName: person.displayName,
			gitEmails: [...person.gitEmails],
			gitNames: [...person.gitNames],
		})));
	},
	async addCardComment(input: CreateCardCommentInput) {
		return trackboiApi.addCardComment(serializeCreateCardCommentInput(input));
	},
	async moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
		return trackboiApi.moveCard(cardId, toColumn, beforeCardId);
	},
	async deleteCard(cardId: string) {
		return trackboiApi.deleteCard(cardId);
	},
	async minimizeWindow() {
		await windowApi.minimize();
		return { ok: true as const };
	},
	async toggleMaximizeWindow() {
		await windowApi.toggleMaximize();
		return { ok: true as const };
	},
	async closeWindow() {
		await windowApi.close();
		return { ok: true as const };
	},
	async startWindowDrag() {
		await windowApi.startDrag();
	},
	async startResize(edge: string) {
		await windowApi.startResize(edge);
	},
	addDesktopStorePatchListener(listener: DesktopStorePatchListener) {
		return trackboiApi.onDesktopStorePatch(listener);
	},
	};
}

export const desktop = createDesktopFacade();

declare global {
	interface Window {
		trackboi: TrackboiBridgeApi;
		trackboiWindow: WindowBridgeApi;
	}
}
