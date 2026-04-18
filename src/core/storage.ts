import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { DEFAULT_BOARD_ID, STORAGE_SEARCH_PATHS } from "./constants";
import { normalizeScope } from "./git";
import { readJson, writeJsonAtomic } from "./json";
import { boardPath, boardsPath, cardPath, cardsPath, projectMetadataPath, storageRoot, tracksPath } from "./paths";
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
	return existsSync(boardPath(rootPath)) ||
		existsSync(projectMetadataPath(rootPath)) ||
		existsSync(cardsPath(rootPath));
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
export function ensureProjectFiles(project: Project, rootPath: string, storagePath: string): void {
	mkdirSync(boardsPath(rootPath), { recursive: true });
	mkdirSync(cardsPath(rootPath), { recursive: true });
	mkdirSync(tracksPath(rootPath), { recursive: true });

	const metadataPath = projectMetadataPath(rootPath);
	if (!existsSync(metadataPath)) {
		writeJsonAtomic<ProjectMetadata>(metadataPath, {
			version: 1,
			projectId: project.id,
			name: project.name,
			storagePath,
			createdAt: now(),
			customFields: [],
		});
	}

	const defaultBoardPath = boardPath(rootPath);
	if (!existsSync(defaultBoardPath)) {
		writeJsonAtomic<Board>(defaultBoardPath, {
			version: 1,
			name: project.name || projectName(project.path),
			columns: defaultColumns(),
			customFields: [],
		});
	}
}

export function normalizeProjectMetadata(metadata: ProjectMetadata, project: Project, storagePath: string): ProjectMetadata {
	return {
		version: 1,
		projectId: typeof metadata.projectId === "string" ? metadata.projectId : project.id,
		name: typeof metadata.name === "string" ? metadata.name : project.name,
		storagePath: typeof metadata.storagePath === "string" ? metadata.storagePath : storagePath,
		createdAt: typeof metadata.createdAt === "string" ? metadata.createdAt : now(),
		customFields: Array.isArray(metadata.customFields) ? metadata.customFields : [],
	};
}

export function normalizeBoard(board: Board, project: Project): Board {
	return {
		version: 1,
		name: typeof board.name === "string" ? board.name : project.name,
		columns: Array.isArray(board.columns) ? board.columns : defaultColumns(),
		customFields: Array.isArray(board.customFields) ? board.customFields : [],
	};
}

export function projectFromMetadata(store: ProjectStore): Project {
	try {
		const metadata = readJson<ProjectMetadata>(projectMetadataPath(store.rootPath));
		return {
			id: metadata.projectId,
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
			if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
			const filePath = path.join(cardDir, entry.name);
			const card = readJson<Card>(filePath);
			const id = path.basename(entry.name, ".json");
			if (card.id !== id) throw new Error(`Card id ${card.id} does not match filename ${id}`);
			card.scope = normalizeScope(card.scope);
			card.boardId ??= DEFAULT_BOARD_ID;
			card.trackId ??= null;
			card.fieldValues ??= {};
			card.comments = normalizeCardComments(card.comments);
			if (card.boardId === DEFAULT_BOARD_ID) cards.push(card);
		}
	}
	cards.sort((left, right) => left.column.localeCompare(right.column) || left.rank.localeCompare(right.rank));
	return cards;
}

export function countCards(rootPath: string): number {
	const cardDir = cardsPath(rootPath);
	if (!existsSync(cardDir)) return 0;

	let count = 0;
	for (const entry of readdirSync(cardDir, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(".json")) count += 1;
	}
	return count;
}

export function deleteCardFile(rootPath: string, cardId: string): void {
	rmSync(cardPath(rootPath, cardId), { force: true });
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

function normalizeCardComments(value: unknown): CardComment[] {
	if (!Array.isArray(value)) return [];

	return value.flatMap((entry): CardComment[] => {
		if (!entry || typeof entry !== "object") return [];
		const comment = entry as Partial<CardComment>;
		if (typeof comment.id !== "string" || typeof comment.body !== "string") return [];

		const timestamp = typeof comment.createdAt === "string" ? comment.createdAt : now();
		return [{
			id: comment.id,
			author: typeof comment.author === "string" && comment.author.trim()
				? comment.author.trim()
				: "Unknown",
			body: comment.body,
			createdAt: timestamp,
			updatedAt: typeof comment.updatedAt === "string" ? comment.updatedAt : timestamp,
		}];
	});
}
