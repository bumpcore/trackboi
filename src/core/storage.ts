import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { DEFAULT_BOARD_ID, STORAGE_SEARCH_PATHS } from "./constants";
import { parseFrontmatter } from "./frontmatter";
import { normalizeScope } from "./git";
import { readJson, writeJsonAtomic } from "./json";
import { boardPath, boardsPath, cardCommentPath, cardCommentsPath, cardDirPath, cardPath, cardsPath, projectMetadataPath, storageRoot, tracksPath } from "./paths";
import type { Board, Card, CardComment, Project, ProjectMetadata, ProjectRegistry } from "./types";

export type ProjectStore = {
	project: Project & { storagePath: string };
	rootPath: string;
	storagePath: string;
};

export function projectName(projectPath: string): string {
	return path.basename(projectPath) || "Project";
}

export function now(): string {
	return new Date().toISOString();
}

export function defaultColumns(): Board["columns"] {
	return [
		{ id: "todo", name: "To Do" },
		{ id: "doing", name: "Doing" },
		{ id: "done", name: "Done" },
	];
}

export function storageExists(rootPath: string): boolean {
	return hasBoards(rootPath) ||
		existsSync(projectMetadataPath(rootPath)) ||
		existsSync(cardsPath(rootPath));
}

export function hasBoards(rootPath: string): boolean {
	const root = boardsPath(rootPath);
	if (!existsSync(root)) return false;
	return readdirSync(root, { withFileTypes: true }).some((entry) => entry.isFile() && entry.name.endsWith(".json"));
}

export function storageCandidates(registry: ProjectRegistry, project: Project | null = null): string[] {
	const candidates: string[] = [];
	if (project?.storagePath) candidates.push(project.storagePath);
	for (const candidate of registry.storageSearchPaths ?? STORAGE_SEARCH_PATHS) {
		if (!candidates.includes(candidate)) candidates.push(candidate);
	}
	return candidates;
}

export function resolveProjectStorage(
	project: Project,
	registry: ProjectRegistry,
	create: boolean,
): { rootPath: string; storagePath: string } | null {
	for (const candidate of storageCandidates(registry, project)) {
		const rootPath = storageRoot(project.path, candidate);
		if (storageExists(rootPath)) return { rootPath, storagePath: candidate };
	}
	if (!create) return null;
	const storagePath = initialStoragePath(project, registry);
	return { rootPath: storageRoot(project.path, storagePath), storagePath };
}

export function openStore(project: Project, registry: ProjectRegistry, create: boolean): ProjectStore {
	const resolved = resolveProjectStorage(project, registry, create);
	if (!resolved) throw new Error("Trackboi storage has not been created for this project");
	return {
		project: { ...project, storagePath: resolved.storagePath },
		rootPath: resolved.rootPath,
		storagePath: resolved.storagePath,
	};
}

/**
 * Creates the minimum repo-local Trackboi database files for a project.
 */
export function ensureProjectFiles(project: Project, rootPath: string, _storagePath: string): void {
	mkdirSync(boardsPath(rootPath), { recursive: true });
	mkdirSync(cardsPath(rootPath), { recursive: true });
	mkdirSync(tracksPath(rootPath), { recursive: true });

	const metadataPath = projectMetadataPath(rootPath);
	if (!existsSync(metadataPath)) {
		writeJsonAtomic<ProjectMetadata>(metadataPath, {
			version: 1,
			name: project.name,
			people: [],
		});
	}

	const defaultBoardPath = boardPath(rootPath);
	if (!existsSync(defaultBoardPath)) {
		writeJsonAtomic<Board>(defaultBoardPath, {
			id: DEFAULT_BOARD_ID,
			version: 1,
			name: project.name || projectName(project.path),
			columns: defaultColumns(),
			customFields: [],
		});
	}
}

export function normalizeProjectMetadata(metadata: ProjectMetadata, project: Project, _storagePath: string): ProjectMetadata {
	return {
		version: 1,
		name: typeof metadata.name === "string" ? metadata.name : project.name,
		people: Array.isArray(metadata.people) ? metadata.people : [],
	};
}

export function normalizeBoard(board: Board, project: Project, boardId = DEFAULT_BOARD_ID): Board {
	return {
		id: typeof board.id === "string" && board.id.length > 0 ? board.id : boardId,
		version: 1,
		name: typeof board.name === "string" ? board.name : project.name,
		columns: Array.isArray(board.columns) ? board.columns : defaultColumns(),
		customFields: Array.isArray(board.customFields) ? board.customFields : [],
	};
}

export function readBoards(rootPath: string, project: Project): Board[] {
	const root = boardsPath(rootPath);
	if (!existsSync(root)) return [];

	const boards: Board[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		const filePath = path.join(root, entry.name);
		const boardId = path.basename(entry.name, ".json");
		boards.push(normalizeBoard(readJson<Board>(filePath), project, boardId));
	}

	boards.sort((left, right) => {
		if (left.id === DEFAULT_BOARD_ID) return -1;
		if (right.id === DEFAULT_BOARD_ID) return 1;
		return left.name.localeCompare(right.name);
	});
	return boards;
}

export function projectFromMetadata(store: ProjectStore): Project {
	try {
		const metadata = readJson<ProjectMetadata>(projectMetadataPath(store.rootPath));
		return {
			name: metadata.name,
			path: store.project.path,
			storagePath: store.storagePath,
		};
	} catch {
		return store.project;
	}
}

export function readCards(rootPath: string): Card[] {
	const cards: Card[] = [];
	const cardDir = cardsPath(rootPath);
	if (existsSync(cardDir)) {
		for (const entry of readdirSync(cardDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			cards.push(readCard(rootPath, entry.name));
		}
	}
	cards.sort((left, right) => left.boardId.localeCompare(right.boardId) || left.column.localeCompare(right.column) || left.rank.localeCompare(right.rank));
	return cards;
}

export function countCards(rootPath: string): number {
	const cardDir = cardsPath(rootPath);
	if (!existsSync(cardDir)) return 0;

	let count = 0;
	for (const entry of readdirSync(cardDir, { withFileTypes: true })) {
		if (entry.isDirectory() && existsSync(cardPath(rootPath, entry.name))) count += 1;
	}
	return count;
}

export function deleteCardFile(rootPath: string, cardId: string): void {
	rmSync(cardDirPath(rootPath, cardId), { recursive: true, force: true });
}

export function canonicalProjectPath(projectPath: string): string {
	return realpathSync(projectPath);
}

function initialStoragePath(project: Project, registry: ProjectRegistry): string {
	const candidates = storageCandidates(registry, project);
	if (
		JSON.stringify(candidates) === JSON.stringify(STORAGE_SEARCH_PATHS) &&
		existsSync(path.join(project.path, ".etc"))
	) {
		return ".etc/.trackboi";
	}
	return candidates[0] ?? STORAGE_SEARCH_PATHS[0];
}

function readCard(rootPath: string, cardId: string): Card {
	const rawMarkdown = readFileSync(cardPath(rootPath, cardId), "utf8");
	const parsed = parseFrontmatter<Partial<Card>>(rawMarkdown);
	const timestamp = now();
	return {
		id: typeof parsed.data.id === "string" ? parsed.data.id : cardId,
		boardId: typeof parsed.data.boardId === "string" ? parsed.data.boardId : DEFAULT_BOARD_ID,
		title: typeof parsed.data.title === "string" ? parsed.data.title : cardId,
		description: parsed.body,
		parentId: typeof parsed.data.parentId === "string" ? parsed.data.parentId : null,
		scope: normalizeScope(parsed.data.scope ?? { kind: "project", ref: "global" }),
		trackId: typeof parsed.data.trackId === "string" ? parsed.data.trackId : null,
		column: typeof parsed.data.column === "string" ? parsed.data.column : "todo",
		rank: typeof parsed.data.rank === "string" ? parsed.data.rank : "",
		labels: Array.isArray(parsed.data.labels) ? parsed.data.labels.filter((label): label is string => typeof label === "string") : [],
		assignee: typeof parsed.data.assignee === "string" ? parsed.data.assignee : null,
		fieldValues: parsed.data.fieldValues && typeof parsed.data.fieldValues === "object" ? parsed.data.fieldValues as Card["fieldValues"] : {},
		comments: readCardComments(rootPath, cardId),
		createdAt: typeof parsed.data.createdAt === "string" ? parsed.data.createdAt : timestamp,
		updatedAt: typeof parsed.data.updatedAt === "string" ? parsed.data.updatedAt : timestamp,
		createdBy: typeof parsed.data.createdBy === "string" ? parsed.data.createdBy : "person_unknown",
		updatedBy: typeof parsed.data.updatedBy === "string" ? parsed.data.updatedBy : "person_unknown",
	};
}

function readCardComments(rootPath: string, cardId: string): CardComment[] {
	const commentsRoot = cardCommentsPath(rootPath, cardId);
	if (!existsSync(commentsRoot)) return [];

	const comments: CardComment[] = [];
	for (const entry of readdirSync(commentsRoot, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const commentId = path.basename(entry.name, ".md");
		const rawMarkdown = readFileSync(cardCommentPath(rootPath, cardId, commentId), "utf8");
		const parsed = parseFrontmatter<Partial<CardComment>>(rawMarkdown);
		const timestamp = typeof parsed.data.createdAt === "string" ? parsed.data.createdAt : now();
		comments.push({
			id: typeof parsed.data.id === "string" ? parsed.data.id : commentId,
			cardId,
			body: parsed.body,
			createdAt: timestamp,
			updatedAt: typeof parsed.data.updatedAt === "string" ? parsed.data.updatedAt : timestamp,
			createdBy: typeof parsed.data.createdBy === "string" ? parsed.data.createdBy : "person_unknown",
			updatedBy: typeof parsed.data.updatedBy === "string" ? parsed.data.updatedBy : "person_unknown",
		});
	}

	comments.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
	return comments;
}
