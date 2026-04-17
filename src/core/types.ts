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
};

export type WorkScope =
	| {
		kind: "project";
		ref: "global";
	}
	| {
		kind: "branch";
		ref: string;
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
	| { kind: "gitWorktrees"; repoRoot: string }
	| { kind: "codeWorkspace"; filePath: string };

export type ProjectEntry = {
	projectId: string;
	name: string;
	path: string;
	storagePath?: string;
	status: ProjectStatus;
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
	storageSearchPaths?: string[];
	activeWorkspaceFile?: string | null;
};

export type GitContext = {
	isGitRepo: boolean;
	root: string | null;
	branch: string | null;
	detached: boolean;
	dirty: boolean | null;
};

export type ProjectSnapshot = {
	project: Project;
	metadata: ProjectMetadata;
	git: GitContext;
	board: Board;
	cards: Card[];
};

export type CardPatch = Partial<
	Pick<Card, "boardId" | "title" | "description" | "parentId" | "scope" | "column" | "rank" | "labels" | "assignee" | "fieldValues">
>;
