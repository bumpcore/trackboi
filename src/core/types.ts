export type Column = {
	id: string;
	name: string;
};

export type FieldType = "text" | "number" | "checkbox" | "select" | "date";

export type FieldValue = string | number | boolean | null;

export type CustomField = {
	id: string;
	name: string;
	type: FieldType;
	options?: string[];
};

export type Board = {
	id: string;
	version: 1;
	name: string;
	columns: Column[];
	customFields: CustomField[];
};

export type BoardStatus = "ready" | "stale";

export type BoardDescriptor = {
	id: string;
	name: string;
	status: BoardStatus;
	worktreeIds: string[];
};

export type GitIdentity = {
	name: string;
	email: string;
};

export type PersonAlias = {
	id: string;
	displayName: string;
	gitEmails: string[];
	gitNames: string[];
};

export type AgentRegistration = {
	id: string;
	name: string;
	description: string;
};

export type EditorPreference = {
	preferredEditorId: string;
	customCommand: string;
};

export type AppSettings = {
	version: 1;
	agents: AgentRegistration[];
	editor: EditorPreference;
};

export type ProjectMetadata = {
	version: 1;
	projectId: string;
	name: string;
	storagePath: string;
	createdAt: string;
	people: PersonAlias[];
};

export type Card = {
	id: string;
	boardId: string;
	title: string;
	description: string;
	parentId: string | null;
	scope: WorkScope;
	trackId: string | null;
	column: string;
	rank: string;
	labels: string[];
	assignee: string | null;
	fieldValues: Record<string, FieldValue>;
	comments: CardComment[];
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
	originWorktreeId?: string;
	originStoragePath?: string;
	worktreeIds?: string[];
	conflicted?: boolean;
	variants?: CardVariant[];
};

export type CardComment = {
	id: string;
	cardId: string;
	body: string;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy: string;
};

export type TrackSource =
	| {
		kind: "manual";
	}
	| {
		kind: "branch";
		ref: string;
	};

export type TrackDecisionStatus = "proposed" | "accepted" | "rejected";

export type TrackDecision = {
	id: string;
	title: string;
	body: string;
	status: TrackDecisionStatus;
	createdAt: string;
	updatedAt: string;
};

export type TrackReferenceKind = "card" | "path" | "branch" | "worktree" | "url";

export type TrackReference = {
	id: string;
	kind: TrackReferenceKind;
	label: string;
	value: string;
};

export type TrackFile = {
	name: string;
	path: string;
	contentType: string;
	updatedAt: string;
};

export type Track = {
	id: string;
	boardId: string;
	title: string;
	slug: string;
	source: TrackSource;
	summary: string;
	plan: string;
	decisions: TrackDecision[];
	references: TrackReference[];
	activity: CardComment[];
	files: TrackFile[];
	createdAt: string;
	updatedAt: string;
	createdBy?: string;
	updatedBy?: string;
	synthetic?: boolean;
	originWorktreeId?: string;
	originStoragePath?: string;
};

export type WorkScope =
	| {
		kind: "project";
		ref: "global";
	}
	| {
		kind: "track";
		ref: string;
	};

export type CardVariant = {
	worktreeId: string;
	worktreeName: string;
	storagePath: string;
	updatedAt: string;
	title: string;
	description: string;
	column: string;
	scope: WorkScope;
	trackId: string | null;
};

export type Project = {
	id: string;
	name: string;
	path: string;
	storagePath?: string;
};

export type ProjectStatus = "ready" | "uninitialized" | "missing";

export type ProjectSourceKind =
	| { kind: "manual" }
	| { kind: "codeWorkspace"; filePath: string };

export type ProjectEntry = {
	projectId: string;
	name: string;
	path: string;
	storagePath?: string;
	status: ProjectStatus;
	branch?: string | null;
	cardCount?: number | null;
};

export type ProjectSource = ProjectSourceKind & {
	id: string;
	label: string;
	entries: ProjectEntry[];
};

export type ProjectView = {
	sources: ProjectSource[];
	activeProjectId: string | null;
	storageSearchPaths: string[];
};

export type ProjectRegistry = {
	projects: Project[];
	activeProjectId: string | null;
	storageSearchPaths: string[];
	activeWorkspaceFile: string | null;
	selectedWorktreeId: string | null;
	selectedBoardId: string | null;
	appSettings: AppSettings;
};

export type GitContext = {
	isGitRepo: boolean;
	root: string | null;
	branch: string | null;
	detached: boolean;
	dirty: boolean | null;
};

export type WorktreeContext = {
	id: string;
	name: string;
	path: string;
	branch: string | null;
	isPrimary: boolean;
	storagePath: string | null;
	storageRoot: string | null;
	status: ProjectStatus;
	cardCount: number;
	colorKey: string;
};

export type ProjectSnapshot = {
	project: Project;
	metadata: ProjectMetadata;
	git: GitContext;
	board: Board;
	boards: BoardDescriptor[];
	tracks: Track[];
	cards: Card[];
};

export type DesktopState = {
	snapshot: ProjectSnapshot | null;
	view: ProjectView;
	worktrees: WorktreeContext[];
	selectedWorktreeId: string | null;
	selectedBoardId: string | null;
};

export type ProjectSnapshotWithInternals = ProjectSnapshot & {
	storageRoot: string;
	boardRecords: Board[];
};

export type CreateCardInput = {
	title: string;
	description?: string;
	parentId?: string | null;
	column: string;
	boardId?: string;
	scope?: WorkScope;
	trackId?: string | null;
	actorId?: string;
};

export type MoveCardInput = {
	cardId: string;
	toColumn: string;
	beforeCardId?: string | null;
};

export type CardPatch = Partial<
	Pick<Card, "boardId" | "title" | "description" | "parentId" | "scope" | "trackId" | "column" | "rank" | "labels" | "assignee" | "fieldValues">
> & {
	actorId?: string;
};

export type CreateCardCommentInput = {
	cardId: string;
	body: string;
	actorId?: string;
};

export type CreateTrackInput = {
	title: string;
	boardId?: string;
	source?: TrackSource;
	summary?: string;
	plan?: string;
	actorId?: string;
};

export type CreateBoardInput = {
	name: string;
};

export type TrackPatch = Partial<
	Pick<Track, "title" | "source" | "summary" | "plan" | "decisions" | "references" | "activity">
> & {
	actorId?: string;
};

export type TrackFileWriteInput = {
	trackId: string;
	name: string;
	content: string;
	contentType?: string;
};

export type TrackFileReadResult = {
	name: string;
	content: string;
	contentType: string;
};

export type RuntimePaths = {
	boardsPath(rootPath: string): string;
	cardsPath(rootPath: string): string;
	cardDirPath(rootPath: string, cardId: string): string;
	boardPath(rootPath: string, boardId?: string): string;
	cardPath(rootPath: string, cardId: string): string;
	cardCommentsPath(rootPath: string, cardId: string): string;
	tracksPath(rootPath: string): string;
	trackPath(rootPath: string, trackId: string): string;
	trackDirPath(rootPath: string, trackId: string): string;
	trackFilesPath(rootPath: string, trackId: string): string;
	trackFilePath(rootPath: string, trackId: string, fileName: string): string;
	projectMetadataPath(rootPath: string): string;
};

export type TrackboiRuntime = {
	paths: RuntimePaths;
	readRegistry(): ProjectRegistry;
	writeRegistry(registry: ProjectRegistry): ProjectRegistry;
	listView(): ProjectView;
	activeSnapshot(): ProjectSnapshot | null;
	activeSnapshotWithInternals(): ProjectSnapshotWithInternals | null;
	readDesktopState(): DesktopState;
	prewarmProjects(): void;
	invalidateCache(): void;
	setSelectedWorktree(worktreeId: string | null): DesktopState;
	listBoards(): BoardDescriptor[];
	setActiveBoard(boardId: string): DesktopState;
	readAppSettings(): AppSettings;
	updateAppSettings(settings: AppSettings): AppSettings;
	updateProjectPeople(people: PersonAlias[]): ProjectMetadata;
	chooseProjectPath(projectPath: string): ProjectSnapshot;
	locateProjectPath(projectId: string, projectPath: string): ProjectSnapshot;
	removeProject(projectId: string): ProjectSnapshot | null;
	switchProject(projectId: string): DesktopState;
	setStorageSearchPaths(paths: string[]): ProjectView;
	setActiveWorkspaceFile(filePath: string | null): ProjectView;
	createBoard(input: CreateBoardInput): ProjectSnapshot;
	deleteBoard(boardId: string): ProjectSnapshot;
	listTracks(): Track[];
	getTrack(trackId: string): Track;
	createTrack(input: CreateTrackInput): Track;
	updateTrack(trackId: string, patch: TrackPatch): Track;
	deleteTrack(trackId: string): { ok: true };
	readTrackFile(trackId: string, fileName: string): TrackFileReadResult;
	writeTrackFile(input: TrackFileWriteInput): TrackFile;
	deleteTrackFile(trackId: string, fileName: string): { ok: true };
	createCard(input: CreateCardInput): Card;
	addCardComment(input: CreateCardCommentInput): CardComment;
	updateCard(cardId: string, patch: CardPatch): Card;
	updateBoard(board: Board): Board;
	moveCard(input: MoveCardInput): Card;
	deleteCard(cardId: string): { ok: true };
};

export type TrackboiActions = {
	getActiveProject(): Promise<ProjectSnapshot | null>;
	listProjects(): Promise<ProjectRegistry>;
	listView(): Promise<ProjectView>;
	readDesktopState(): Promise<DesktopState>;
	prewarmProjects(): Promise<void>;
	setSelectedWorktree(worktreeId: string | null): Promise<DesktopState>;
	listBoards(): Promise<BoardDescriptor[]>;
	setActiveBoard(boardId: string): Promise<DesktopState>;
	readAppSettings(): Promise<AppSettings>;
	updateAppSettings(settings: AppSettings): Promise<AppSettings>;
	updateProjectPeople(people: PersonAlias[]): Promise<ProjectMetadata>;
	setStorageSearchPaths(paths: string[]): Promise<ProjectView>;
	setActiveWorkspaceFile(filePath: string | null): Promise<ProjectView>;
	createBoard(input: CreateBoardInput): Promise<ProjectSnapshot>;
	deleteBoard(boardId: string): Promise<ProjectSnapshot>;
	listTracks(): Promise<Track[]>;
	getTrack(trackId: string): Promise<Track>;
	createTrack(input: CreateTrackInput): Promise<Track>;
	updateTrack(trackId: string, patch: TrackPatch): Promise<Track>;
	deleteTrack(trackId: string): Promise<{ ok: true }>;
	readTrackFile(trackId: string, fileName: string): Promise<TrackFileReadResult>;
	writeTrackFile(input: TrackFileWriteInput): Promise<TrackFile>;
	deleteTrackFile(trackId: string, fileName: string): Promise<{ ok: true }>;
	openWorkspaceFile(): Promise<ProjectView | null>;
	chooseProject(): Promise<ProjectSnapshot | null>;
	locateProject(projectId: string): Promise<ProjectSnapshot | null>;
	removeProject(projectId: string): Promise<ProjectSnapshot | null>;
	switchProject(projectId: string): Promise<DesktopState>;
	createCard(input: CreateCardInput): Promise<Card>;
	addCardComment(input: CreateCardCommentInput): Promise<CardComment>;
	updateCard(cardId: string, patch: CardPatch): Promise<Card>;
	updateBoard(board: Board): Promise<Board>;
	moveCard(cardId: string, toColumn: string, beforeCardId: string | null): Promise<Card>;
	deleteCard(cardId: string): Promise<{ ok: true }>;
};
