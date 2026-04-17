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
	version: 1;
	name: string;
	columns: Column[];
	customFields: CustomField[];
};

export type ProjectMetadata = {
	version: 1;
	projectId: string;
	name: string;
	storagePath: string;
	createdAt: string;
	customFields: CustomField[];
};

export type Card = {
	id: string;
	boardId: string;
	title: string;
	description: string;
	parentId: string | null;
	scope: WorkScope;
	column: string;
	rank: string;
	labels: string[];
	assignee: string | null;
	fieldValues: Record<string, FieldValue>;
	createdAt: string;
	updatedAt: string;
	originWorktreeId?: string;
	originStoragePath?: string;
	worktreeIds?: string[];
	conflicted?: boolean;
	variants?: CardVariant[];
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
	cards: Card[];
};

export type DesktopState = {
	snapshot: ProjectSnapshot | null;
	view: ProjectView;
	worktrees: WorktreeContext[];
	selectedWorktreeId: string | null;
};

export type ProjectSnapshotWithInternals = ProjectSnapshot & {
	storageRoot: string;
};

export type CreateCardInput = {
	title: string;
	description?: string;
	parentId?: string | null;
	column: string;
	scope?: WorkScope;
	targetWorktreeId?: string | null;
};

export type MoveCardInput = {
	cardId: string;
	toColumn: string;
	beforeCardId?: string | null;
};

export type CardPatch = Partial<
	Pick<Card, "boardId" | "title" | "description" | "parentId" | "scope" | "column" | "rank" | "labels" | "assignee" | "fieldValues">
>;

export type RuntimePaths = {
	boardsPath(rootPath: string): string;
	cardsPath(rootPath: string): string;
	boardPath(rootPath: string): string;
	cardPath(rootPath: string, cardId: string): string;
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
	invalidateCache(): void;
	setSelectedWorktree(worktreeId: string | null): DesktopState;
	chooseProjectPath(projectPath: string): ProjectSnapshot;
	locateProjectPath(projectId: string, projectPath: string): ProjectSnapshot;
	removeProject(projectId: string): ProjectSnapshot | null;
	switchProject(projectId: string): ProjectSnapshot | null;
	setStorageSearchPaths(paths: string[]): ProjectView;
	setActiveWorkspaceFile(filePath: string | null): ProjectView;
	createCard(input: CreateCardInput): Card;
	updateCard(cardId: string, patch: CardPatch): Card;
	updateBoard(board: Board): Board;
	updateCustomFields(customFields: CustomField[]): ProjectMetadata;
	moveCard(input: MoveCardInput): Card;
	deleteCard(cardId: string): { ok: true };
};
