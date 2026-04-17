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

export type Card = {
	id: string;
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

export type ProjectIndexEntry = Project & {
	status: ProjectStatus;
};

export type ProjectIndex = {
	projects: ProjectIndexEntry[];
	activeProjectId: string | null;
	storageSearchPaths: string[];
};

export type ProjectRegistry = {
	projects: Project[];
	activeProjectId: string | null;
	storageSearchPaths?: string[];
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
	git: GitContext;
	board: Board;
	cards: Card[];
};

export type CardPatch = Partial<
	Pick<Card, "title" | "description" | "parentId" | "scope" | "column" | "rank" | "labels" | "assignee" | "fieldValues">
>;
