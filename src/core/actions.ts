import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { createRuntime, stripInternalSnapshotFields, type RuntimeOptions } from "./runtime";
import type {
	AppSettings,
	Board,
	Card,
	CardComment,
	CardPatch,
	CreateCardCommentInput,
	CreateCardInput,
	CreateBoardInput,
	CreateTrackInput,
	DesktopState,
	GitChanges,
	GitCommitInput,
	GitCommitResult,
	MoveCardInput,
	PersonAlias,
	ProjectMetadata,
	ProjectSettingsPatch,
	ProjectRegistry,
	ProjectSnapshot,
	ProjectSnapshotWithInternals,
	ProjectView,
	RuntimePaths,
	Track,
	TrackFile,
	TrackFileReadResult,
	TrackFileWriteInput,
	TrackPatch,
	TrackboiActions,
	TrackboiRuntime,
	ScopedTrackboiContext,
} from "./types";

export type TrackboiSystemDialogs = {
	chooseProjectDirectory(): Promise<string | null>;
	chooseWorkspaceFile(): Promise<string | null>;
	chooseProjectIconFile(): Promise<string | null>;
};

export type NodeFsTrackboiActions = TrackboiActions & {
	runtime: TrackboiRuntime;
	paths: RuntimePaths;
	readRegistry(): ProjectRegistry;
	writeRegistry(registry: ProjectRegistry): ProjectRegistry;
	activeSnapshot(): ProjectSnapshot | null;
	activeSnapshotWithInternals(): ProjectSnapshotWithInternals | null;
	invalidateCache(): void;
	invalidateStorageRoot(rootPath: string): void;
	withScopedContext<T>(context: ScopedTrackboiContext, action: (actions: NodeFsTrackboiActions) => Promise<T>): Promise<T>;
};

type NodeFsTrackboiActionsOptions = {
	runtime?: TrackboiRuntime;
	runtimeOptions?: RuntimeOptions;
	dialogs?: Partial<TrackboiSystemDialogs>;
};

const defaultDialogs: TrackboiSystemDialogs = {
	async chooseProjectDirectory() {
		return null;
	},
	async chooseWorkspaceFile() {
		return null;
	},
	async chooseProjectIconFile() {
		return null;
	},
};

class NodeFsTrackboiActionsImpl implements NodeFsTrackboiActions {
	readonly runtime: TrackboiRuntime;

	readonly paths: RuntimePaths;

	private readonly dialogs: TrackboiSystemDialogs;

	constructor(options: NodeFsTrackboiActionsOptions = {}) {
		this.runtime = options.runtime ?? createRuntime(options.runtimeOptions);
		this.paths = this.runtime.paths;
		this.dialogs = {
			...defaultDialogs,
			...options.dialogs,
		};
	}

	readRegistry(): ProjectRegistry {
		return this.runtime.readRegistry();
	}

	writeRegistry(registry: ProjectRegistry): ProjectRegistry {
		return this.runtime.writeRegistry(registry);
	}

	activeSnapshot(): ProjectSnapshot | null {
		return this.runtime.activeSnapshot();
	}

	activeSnapshotWithInternals(): ProjectSnapshotWithInternals | null {
		return this.runtime.activeSnapshotWithInternals();
	}

	invalidateCache(): void {
		this.runtime.invalidateCache();
	}

	invalidateStorageRoot(rootPath: string): void {
		this.runtime.invalidateStorageRoot(rootPath);
	}

	async withScopedContext<T>(context: ScopedTrackboiContext, action: (actions: NodeFsTrackboiActions) => Promise<T>): Promise<T> {
		const tempDir = mkdtempSync(path.join(os.tmpdir(), "trackboi-mcp-"));
		const scopedConfigPath = path.join(tempDir, "config.json");
		try {
			const scoped = createNodeFsTrackboiActions({
				runtimeOptions: {
					configPath: scopedConfigPath,
				},
			});
			const registry = this.readRegistry();
			scoped.writeRegistry({
				...registry,
				activeProjectPath: context.projectPath,
				selectedWorktreeId: context.worktreeId,
				selectedBoardId: context.boardId,
			});
			return await action(scoped);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	}

	async getActiveProject(): Promise<ProjectSnapshot | null> {
		return stripInternalSnapshotFields(this.runtime.activeSnapshotWithInternals());
	}

	async listProjects(): Promise<ProjectRegistry> {
		return this.runtime.readRegistry();
	}

	async listView(): Promise<ProjectView> {
		return this.runtime.listView();
	}

	async readDesktopState(): Promise<DesktopState> {
		return this.runtime.readDesktopState();
	}

	async prewarmProjects(): Promise<void> {
		this.runtime.prewarmProjects();
	}

	async setSelectedWorktree(worktreeId: string | null): Promise<DesktopState> {
		return this.runtime.setSelectedWorktree(worktreeId);
	}

	async listBoards() {
		return this.runtime.listBoards();
	}

	async setActiveBoard(boardId: string): Promise<DesktopState> {
		return this.runtime.setActiveBoard(boardId);
	}

	async readAppSettings(): Promise<AppSettings> {
		return this.runtime.readAppSettings();
	}

	async updateAppSettings(settings: AppSettings): Promise<AppSettings> {
		return this.runtime.updateAppSettings(settings);
	}

	async listGitChanges(paths?: string[]): Promise<GitChanges> {
		return this.runtime.listGitChanges(paths);
	}

	async commitGitChanges(input: GitCommitInput): Promise<GitCommitResult> {
		return this.runtime.commitGitChanges(input);
	}

	async updateProjectSettings(patch: ProjectSettingsPatch): Promise<ProjectMetadata> {
		return this.runtime.updateProjectSettings(patch);
	}

	async setStorageSearchPaths(paths: string[]): Promise<ProjectView> {
		return this.runtime.setStorageSearchPaths(paths);
	}

	async setActiveWorkspaceFile(filePath: string | null): Promise<ProjectView> {
		return this.runtime.setActiveWorkspaceFile(filePath);
	}

	async createBoard(input: CreateBoardInput): Promise<ProjectSnapshot> {
		return this.runtime.createBoard(input);
	}

	async deleteBoard(boardId: string): Promise<ProjectSnapshot> {
		return this.runtime.deleteBoard(boardId);
	}

	async listTracks(): Promise<Track[]> {
		return this.runtime.listTracks();
	}

	async getTrack(trackId: string): Promise<Track> {
		return this.runtime.getTrack(trackId);
	}

	async createTrack(input: CreateTrackInput): Promise<Track> {
		return this.runtime.createTrack(input);
	}

	async updateTrack(trackId: string, patch: TrackPatch): Promise<Track> {
		return this.runtime.updateTrack(trackId, patch);
	}

	async deleteTrack(trackId: string): Promise<{ ok: true }> {
		return this.runtime.deleteTrack(trackId);
	}

	async readTrackFile(trackId: string, fileName: string): Promise<TrackFileReadResult> {
		return this.runtime.readTrackFile(trackId, fileName);
	}

	async writeTrackFile(input: TrackFileWriteInput): Promise<TrackFile> {
		return this.runtime.writeTrackFile(input);
	}

	async deleteTrackFile(trackId: string, fileName: string): Promise<{ ok: true }> {
		return this.runtime.deleteTrackFile(trackId, fileName);
	}

	async openWorkspaceFile(): Promise<ProjectView | null> {
		const filePath = await this.dialogs.chooseWorkspaceFile();
		if (!filePath) return null;
		return this.runtime.setActiveWorkspaceFile(filePath);
	}

	async chooseProjectIconFile(): Promise<string | null> {
		return this.dialogs.chooseProjectIconFile();
	}

	async chooseProject(): Promise<ProjectSnapshot | null> {
		const projectPath = await this.dialogs.chooseProjectDirectory();
		if (!projectPath) return this.getActiveProject();
		this.runtime.chooseProjectPath(projectPath);
		return this.getActiveProject();
	}

	async locateProject(currentProjectPath: string): Promise<ProjectSnapshot | null> {
		const projectPath = await this.dialogs.chooseProjectDirectory();
		if (!projectPath) return this.getActiveProject();
		this.runtime.locateProjectPath(currentProjectPath, projectPath);
		return this.getActiveProject();
	}

	async removeProject(projectPath: string): Promise<ProjectSnapshot | null> {
		this.runtime.removeProject(projectPath);
		return this.getActiveProject();
	}

	async switchProject(projectPath: string): Promise<DesktopState> {
		return this.runtime.switchProject(projectPath);
	}

	async createCard(input: CreateCardInput): Promise<Card> {
		return this.runtime.createCard(input);
	}

	async addCardComment(input: CreateCardCommentInput): Promise<CardComment> {
		return this.runtime.addCardComment(input);
	}

	async updateCard(cardId: string, patch: CardPatch): Promise<Card> {
		return this.runtime.updateCard(cardId, patch);
	}

	async updateBoard(board: Board): Promise<Board> {
		return this.runtime.updateBoard(board);
	}

	async updateProjectPeople(people: PersonAlias[]): Promise<ProjectMetadata> {
		return this.runtime.updateProjectPeople(people);
	}

	async moveCard(cardId: string, toColumn: string, beforeCardId: string | null): Promise<Card> {
		const input: MoveCardInput = { cardId, toColumn, beforeCardId };
		return this.runtime.moveCard(input);
	}

	async deleteCard(cardId: string): Promise<{ ok: true }> {
		return this.runtime.deleteCard(cardId);
	}
}

export function createNodeFsTrackboiActions(options: NodeFsTrackboiActionsOptions = {}): NodeFsTrackboiActions {
	return new NodeFsTrackboiActionsImpl(options);
}
