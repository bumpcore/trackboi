import { existsSync } from "node:fs";
import { readGitContext } from "../git";
import { jsonEquals, readJson, writeJsonAtomic } from "../json";
import { boardPath, projectMetadataPath } from "../paths";
import {
	ensureProjectFiles,
	normalizeBoard,
	normalizeProjectMetadata,
	openStore,
	projectFromMetadata,
	readCards,
	type ProjectStore,
} from "../storage";
import { readTracks } from "../tracks";
import type {
	Board,
	Project,
	ProjectMetadata,
	ProjectRegistry,
	ProjectSnapshotWithInternals,
} from "../types";

type RegistryReader = () => ProjectRegistry;
type RegistryWriter = (registry: ProjectRegistry) => void;

function rememberProjectStorage(
	projectId: string,
	storagePath: string,
	readRegistry: RegistryReader,
	writeRegistry: RegistryWriter,
): void {
	const current = readRegistry();
	const project = current.projects.find((entry) => entry.id === projectId);
	if (!project || project.storagePath === storagePath) return;
	project.storagePath = storagePath;
	writeRegistry(current);
}

/**
 * Reads one project/worktree store and normalizes its on-disk board/project
 * files without rewriting unchanged content.
 */
export function readSnapshotForProjectPath(options: {
	project: Project;
	projectPath: string;
	create: boolean;
	readRegistry: RegistryReader;
	writeRegistry: RegistryWriter;
	snapshotCache: Map<string, ProjectSnapshotWithInternals>;
}): ProjectSnapshotWithInternals | null {
	const { project, projectPath, create, readRegistry, writeRegistry, snapshotCache } = options;
	if (!existsSync(projectPath)) return null;

	const store = openStore(project, readRegistry(), create);
	ensureProjectFiles(store.project, store.rootPath, store.storagePath);
	rememberProjectStorage(project.id, store.storagePath, readRegistry, writeRegistry);
	const cached = snapshotCache.get(store.rootPath);
	if (cached) return cached;

	const metadata = readNormalizedMetadata(store, project);
	const { board, metadata: normalizedMetadata } = readNormalizedBoard(store, project, metadata);
	const snapshot = {
		project: projectFromMetadata(store),
		metadata: normalizedMetadata,
		git: readGitContext(project.path),
		board,
		tracks: readTracks(store.rootPath),
		cards: readCards(store.rootPath),
		storageRoot: store.rootPath,
	};
	snapshotCache.set(store.rootPath, snapshot);
	return snapshot;
}

function readNormalizedMetadata(
	store: ProjectStore,
	project: Project,
): ProjectMetadata {
	const filePath = projectMetadataPath(store.rootPath);
	const rawMetadata = readJson<ProjectMetadata>(filePath);
	const metadata = normalizeProjectMetadata(rawMetadata, project, store.storagePath);
	if (!jsonEquals(rawMetadata, metadata)) {
		writeJsonAtomic(filePath, metadata);
	}

	return metadata;
}

function readNormalizedBoard(
	store: ProjectStore,
	project: Project,
	metadata: ProjectMetadata,
): { board: Board; metadata: ProjectMetadata } {
	const filePath = boardPath(store.rootPath);
	const rawBoard = readJson<Board>(filePath);
	const board = normalizeBoard(rawBoard, project);
	if (!jsonEquals(rawBoard, board)) {
		writeJsonAtomic(filePath, board);
	}
	if (metadata.customFields.length > 0 || board.customFields.length === 0) {
		return { board, metadata };
	}

	const nextMetadata = { ...metadata, customFields: board.customFields };
	writeJsonAtomic(projectMetadataPath(store.rootPath), nextMetadata);
	return { board, metadata: nextMetadata };
}
