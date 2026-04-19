import { existsSync } from "node:fs";
import { readGitContext } from "../git";
import { jsonEquals, readJson, writeJsonAtomic } from "../json";
import { projectMetadataPath } from "../paths";
import {
	ensureProjectFiles,
	normalizeProjectMetadata,
	openStore,
	projectFromMetadata,
	readBoards,
	readCards,
	type ProjectStore,
} from "../storage";
import { readTracks } from "../tracks";
import type {
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
	const boardRecords = readBoards(store.rootPath, project);
	const primaryBoard = boardRecords[0];
	const snapshot = {
		project: projectFromMetadata(store),
		metadata,
		git: readGitContext(project.path),
		board: primaryBoard,
		boards: boardRecords.map((board) => ({
			id: board.id,
			name: board.name,
			status: "ready" as const,
			worktreeIds: [],
		})),
		tracks: readTracks(store.rootPath),
		cards: readCards(store.rootPath),
		storageRoot: store.rootPath,
		boardRecords,
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
