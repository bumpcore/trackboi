export type Column = {
	id: string;
	name: string;
};

export type Board = {
	version: 1;
	name: string;
	columns: Column[];
};

export type Card = {
	id: string;
	title: string;
	description: string;
	column: string;
	rank: string;
	labels: string[];
	assignee: string | null;
	createdAt: string;
	updatedAt: string;
};

export type Project = {
	id: string;
	name: string;
	path: string;
};

export type ProjectRegistry = {
	projects: Project[];
	activeProjectId: string | null;
};

export type WindowFrame = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type ProjectSnapshot = {
	project: Project;
	board: Board;
	cards: Card[];
};

export type CardPatch = Partial<
	Pick<Card, "title" | "description" | "column" | "rank" | "labels" | "assignee">
>;
