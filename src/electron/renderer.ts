import type {
	AppSettings,
	Board,
	CardComment,
	CardPatch,
	CreateCardCommentInput,
	CreateTrackInput,
	CustomField,
	DesktopState,
	PersonAlias,
	ProjectSnapshot,
	TrackDecision,
	TrackPatch,
	TrackReference,
	TrackSource,
	TrackFileWriteInput,
	WorkScope,
} from "@/core/types";
import type { TrackboiBridgeApi, WindowBridgeApi } from "./bridge";
import { trackboi } from "./trackboi";
import { windowShell } from "./window";

type BoardChangedListener = (snapshot: ProjectSnapshot | null) => void;

function serializeCustomField(field: CustomField): CustomField {
	return field.options
		? { ...field, options: [...field.options] }
		: { ...field };
}

function serializeWorkScope(scope: WorkScope): WorkScope {
	return scope.kind === "project"
		? { kind: "project", ref: "global" }
		: { kind: "track", ref: scope.ref };
}

function serializeCreateCardInput(input: {
	boardId?: string;
	title: string;
	description?: string;
	parentId?: string | null;
	column: string;
	scope?: WorkScope;
	trackId?: string | null;
	actorId?: string;
}) {
	return {
		boardId: input.boardId,
		title: input.title,
		description: input.description,
		parentId: input.parentId,
		column: input.column,
		scope: input.scope ? serializeWorkScope(input.scope) : undefined,
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
		scope: patch.scope ? serializeWorkScope(patch.scope) : undefined,
		trackId: patch.trackId,
		column: patch.column,
		rank: patch.rank,
		labels: patch.labels ? [...patch.labels] : undefined,
		assignee: patch.assignee,
		fieldValues: patch.fieldValues ? { ...patch.fieldValues } : undefined,
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

function serializeTrackSource(source: TrackSource): TrackSource {
	return source.kind === "branch"
		? { kind: "branch", ref: source.ref }
		: { kind: "manual" };
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

function serializeTrackActivityComment(comment: CardComment): CardComment {
	return {
		id: comment.id,
		cardId: comment.cardId,
		body: comment.body,
		createdAt: comment.createdAt,
		updatedAt: comment.updatedAt,
		createdBy: comment.createdBy,
		updatedBy: comment.updatedBy,
	};
}

function serializeCreateTrackInput(input: CreateTrackInput): CreateTrackInput {
	return {
		title: input.title,
		boardId: input.boardId,
		source: input.source ? serializeTrackSource(input.source) : undefined,
		summary: input.summary,
		plan: input.plan,
		actorId: input.actorId,
	};
}

function serializeTrackPatch(patch: TrackPatch): TrackPatch {
	return {
		title: patch.title,
		source: patch.source ? serializeTrackSource(patch.source) : undefined,
		summary: patch.summary,
		plan: patch.plan,
		decisions: patch.decisions ? patch.decisions.map(serializeTrackDecision) : undefined,
		references: patch.references ? patch.references.map(serializeTrackReference) : undefined,
		activity: patch.activity ? patch.activity.map(serializeTrackActivityComment) : undefined,
		actorId: patch.actorId,
	};
}

function serializeAppSettings(settings: AppSettings): AppSettings {
	return {
		version: settings.version,
		agents: settings.agents.map((agent) => ({
			id: agent.id,
			name: agent.name,
			description: agent.description,
		})),
		editor: {
			preferredEditorId: settings.editor.preferredEditorId,
			customCommand: settings.editor.customCommand,
		},
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
	const listeners = new Set<BoardChangedListener>();
	let projectChangeListenerStarted = false;
	let projectChangeRefreshQueued = false;
	let projectPrewarmQueued = false;
	let projectPrewarmInFlight = false;

	function notifyListeners(snapshot: ProjectSnapshot | null): void {
		for (const listener of listeners) listener(snapshot);
	}

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

	async function notifyBoardChanged() {
		const snapshot = await trackboiApi.getActiveProject();
		notifyListeners(snapshot);
		return snapshot;
	}

	/**
	 * Starts the main-to-renderer project-change subscription once and coalesces
	 * bursty filesystem events into one snapshot refresh.
	 */
	function startProjectChangeListener() {
		if (projectChangeListenerStarted) return;
		projectChangeListenerStarted = true;

		trackboiApi.onProjectChanged(() => {
			if (projectChangeRefreshQueued) return;
			projectChangeRefreshQueued = true;
			globalThis.setTimeout(() => {
				projectChangeRefreshQueued = false;
				void notifyBoardChanged();
			}, 120);
		});
	}

	async function refreshAfterMutation<T>(action: () => Promise<T>): Promise<T> {
		const result = await action();
		await notifyBoardChanged();
		return result;
	}

	async function refreshAfterProjectSelection<T>(action: () => Promise<T>, snapshotSelector: (result: T) => ProjectSnapshot | null): Promise<T> {
		const result = await action();
		notifyListeners(snapshotSelector(result));
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
		const nextState = await trackboiApi.setActiveBoard(boardId);
		notifyListeners(nextState.snapshot);
		return nextState;
	},
	async readAppSettings() {
		return trackboiApi.readAppSettings();
	},
	async updateAppSettings(settings: AppSettings) {
		return trackboiApi.updateAppSettings(serializeAppSettings(settings));
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
		return refreshAfterMutation(() => trackboiApi.createBoard(input));
	},
	async deleteBoard(boardId: string) {
		return refreshAfterMutation(() => trackboiApi.deleteBoard(boardId));
	},
	async listTracks() {
		return trackboiApi.listTracks();
	},
	async getTrack(trackId: string) {
		return trackboiApi.getTrack(trackId);
	},
	async createTrack(input: CreateTrackInput) {
		return refreshAfterMutation(() => trackboiApi.createTrack(serializeCreateTrackInput(input)));
	},
	async updateTrack(trackId: string, patch: TrackPatch) {
		return refreshAfterMutation(() => trackboiApi.updateTrack(trackId, serializeTrackPatch(patch)));
	},
	async deleteTrack(trackId: string) {
		return refreshAfterMutation(() => trackboiApi.deleteTrack(trackId));
	},
	async readTrackFile(trackId: string, fileName: string) {
		return trackboiApi.readTrackFile(trackId, fileName);
	},
	async writeTrackFile(input: TrackFileWriteInput) {
		return refreshAfterMutation(() => trackboiApi.writeTrackFile(input));
	},
	async deleteTrackFile(trackId: string, fileName: string) {
		return refreshAfterMutation(() => trackboiApi.deleteTrackFile(trackId, fileName));
	},
	async openWorkspaceFile() {
		return trackboiApi.openWorkspaceFile();
	},
	async chooseProject() {
		return refreshAfterProjectSelection(() => trackboiApi.chooseProject(), (snapshot) => snapshot);
	},
	async locateProject(projectId: string) {
		return refreshAfterProjectSelection(() => trackboiApi.locateProject(projectId), (snapshot) => snapshot);
	},
	async removeProject(projectId: string) {
		return refreshAfterProjectSelection(() => trackboiApi.removeProject(projectId), (snapshot) => snapshot);
	},
	async switchProject(projectId: string) {
		return refreshAfterProjectSelection(() => trackboiApi.switchProject(projectId), (nextState) => nextState.snapshot);
	},
	async createCard(input: {
		boardId?: string;
		title: string;
		description?: string;
		parentId?: string | null;
		column: string;
		scope?: WorkScope;
		trackId?: string | null;
	}) {
		return refreshAfterMutation(() => trackboiApi.createCard(serializeCreateCardInput(input)));
	},
	async updateCard(cardId: string, patch: CardPatch) {
		return refreshAfterMutation(() => trackboiApi.updateCard(cardId, serializeCardPatch(patch)));
	},
	async updateBoard(board: Board) {
		return refreshAfterMutation(() => trackboiApi.updateBoard(serializeBoard(board)));
	},
	async updateProjectPeople(people: PersonAlias[]) {
		return refreshAfterMutation(() => trackboiApi.updateProjectPeople(people.map((person) => ({
			id: person.id,
			displayName: person.displayName,
			gitEmails: [...person.gitEmails],
			gitNames: [...person.gitNames],
		}))));
	},
	async addCardComment(input: CreateCardCommentInput) {
		return refreshAfterMutation(() => trackboiApi.addCardComment(serializeCreateCardCommentInput(input)));
	},
	async moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
		return refreshAfterMutation(() => trackboiApi.moveCard(cardId, toColumn, beforeCardId));
	},
	async deleteCard(cardId: string) {
		return refreshAfterMutation(() => trackboiApi.deleteCard(cardId));
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
	addBoardChangedListener(listener: BoardChangedListener) {
		startProjectChangeListener();
		listeners.add(listener);
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
