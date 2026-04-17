import { existsSync } from "node:fs";
import { createCardInStore, deleteCardInStore, moveCardInStore, updateCardInStore } from "./cards";
import { readGitContext } from "./git";
import { newId } from "./id";
import { readJson, writeJsonAtomic } from "./json";
import { boardPath, projectMetadataPath, runtimePaths } from "./paths";
import { createRegistryStore, normalizeStorageSearchPaths, type RegistryOptions } from "./registry";
import {
	canonicalProjectPath,
	ensureProjectFiles,
	openStore,
	projectFromMetadata,
	projectName,
	readCards,
	resolveProjectStorage,
	storageCandidates,
} from "./storage";
import {
	activeProjectFromRegistry,
	canonicalStorageKey,
	listWorktreeSource,
	listWorkspaceSource,
	projectEntry,
} from "./sources";
import type {
	Board,
	Card,
	CardPatch,
	CreateCardInput,
	CustomField,
	MoveCardInput,
	Project,
	ProjectMetadata,
	ProjectSnapshot,
	ProjectSnapshotWithInternals,
	ProjectSource,
	ProjectView,
	TrackboiRuntime,
} from "./types";

export type RuntimeOptions = RegistryOptions;

/**
 * Creates the public Trackboi core API.
 *
 * Electron, CLI, and MCP should all enter through this facade so filesystem
 * writes stay consistent regardless of which client initiated an action.
 */
export function createRuntime(options: RuntimeOptions = {}): TrackboiRuntime {
	const registry = createRegistryStore(options);

	function rememberProjectStorage(projectId: string, storagePath: string): void {
		const current = registry.readRegistry();
		const project = current.projects.find((entry) => entry.id === projectId);
		if (project && project.storagePath !== storagePath) {
			project.storagePath = storagePath;
			registry.writeRegistry(current);
		}
	}

	function readSnapshotForProject(project: Project, create = true): ProjectSnapshotWithInternals {
		const current = registry.readRegistry();
		const store = openStore(project, current, create);
		ensureProjectFiles(store.project, store.rootPath, store.storagePath);
		rememberProjectStorage(store.project.id, store.storagePath);

		let metadata = readJson<ProjectMetadata>(projectMetadataPath(store.rootPath));
		const board = readJson<Board>(boardPath(store.rootPath));
		if (metadata.customFields.length === 0 && board.customFields.length > 0) {
			metadata = { ...metadata, customFields: board.customFields };
			writeJsonAtomic(projectMetadataPath(store.rootPath), metadata);
		}

		const nextProject = projectFromMetadata(store);
		return {
			project: nextProject,
			metadata,
			git: readGitContext(nextProject.path),
			board,
			cards: readCards(store.rootPath),
			storageRoot: store.rootPath,
		};
	}

	function activeSnapshotWithInternals(): ProjectSnapshotWithInternals | null {
		const project = activeProjectFromRegistry(registry.readRegistry());
		if (!project || !existsSync(project.path)) return null;
		return readSnapshotForProject(project, true);
	}

	function activeSnapshot(): ProjectSnapshot | null {
		return stripInternalSnapshotFields(activeSnapshotWithInternals());
	}

	function listView(): ProjectView {
		const current = registry.readRegistry();
		const seen = new Set<string>();
		const sources: ProjectSource[] = [];
		const candidates: Array<ProjectSource | null> = [
			{
				id: "manual",
				kind: "manual",
				label: "Projects",
				entries: current.projects.map((project) => projectEntry(project, current)),
			},
			listWorktreeSource(current),
			listWorkspaceSource(current),
		];

		for (const source of candidates) {
			if (!source) continue;
			const entries = source.entries.filter((entry) => {
				const key = canonicalStorageKey(entry, current);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
			sources.push({ ...source, entries });
		}

		return {
			sources,
			activeProjectId: current.activeProjectId,
			storageSearchPaths: storageCandidates(current),
		};
	}

	function requireActiveProject(): Project {
		const project = activeProjectFromRegistry(registry.readRegistry());
		if (!project) throw new Error("Choose a project first");
		return project;
	}

	function activeStore(create: boolean) {
		return openStore(requireActiveProject(), registry.readRegistry(), create);
	}

	function chooseProjectPath(projectPath: string): ProjectSnapshot {
		const canonicalPath = canonicalProjectPath(projectPath);
		const current = registry.readRegistry();
		const existing = current.projects.find((project) => project.path === canonicalPath);
			if (existing) {
				current.activeProjectId = existing.id;
				registry.writeRegistry(current);
				return toPublicSnapshot(readSnapshotForProject(existing, true));
			}

		const project: Project = {
			id: newId("project"),
			name: projectName(canonicalPath),
			path: canonicalPath,
			storagePath: undefined,
		};
		project.storagePath = resolveProjectStorage(project, current, true)?.storagePath;
		current.projects.push(project);
		current.activeProjectId = project.id;
		registry.writeRegistry(current);
		return toPublicSnapshot(readSnapshotForProject(project, true));
	}

	function locateProjectPath(projectId: string, projectPath: string): ProjectSnapshot {
		const canonicalPath = canonicalProjectPath(projectPath);
		const current = registry.readRegistry();
		const project = current.projects.find((entry) => entry.id === projectId);
		if (!project) throw new Error(`Unknown project: ${projectId}`);
		project.path = canonicalPath;
		project.name = projectName(canonicalPath);
		project.storagePath = resolveProjectStorage(project, current, true)?.storagePath;
		current.activeProjectId = project.id;
		registry.writeRegistry(current);
		return toPublicSnapshot(readSnapshotForProject(project, true));
	}

	function removeProject(projectId: string): ProjectSnapshot | null {
		const current = registry.readRegistry();
		const previousLength = current.projects.length;
		current.projects = current.projects.filter((project) => project.id !== projectId);
		if (current.projects.length === previousLength) throw new Error(`Unknown project: ${projectId}`);
		if (current.activeProjectId === projectId) current.activeProjectId = current.projects[0]?.id ?? null;
		registry.writeRegistry(current);
		return activeSnapshot();
	}

	function switchProject(projectId: string): ProjectSnapshot | null {
		const current = registry.readRegistry();
		const entry = listView().sources
			.flatMap((source) => source.entries)
			.find((candidate) => candidate.projectId === projectId);
		if (!entry) throw new Error(`Unknown project: ${projectId}`);
		current.activeProjectId = projectId;
		registry.writeRegistry(current);
		return activeSnapshot();
	}

	function setStorageSearchPaths(paths: string[]): ProjectView {
		const current = registry.readRegistry();
		current.storageSearchPaths = normalizeStorageSearchPaths(paths);
		registry.writeRegistry(current);
		return listView();
	}

	function setActiveWorkspaceFile(filePath: string | null): ProjectView {
		const current = registry.readRegistry();
		current.activeWorkspaceFile = filePath || null;
		registry.writeRegistry(current);
		return listView();
	}

	function createCard(input: CreateCardInput): Card {
		const snapshot = activeSnapshotWithInternals();
		if (!snapshot) throw new Error("Choose a project first");
		return createCardInStore(activeStore(true), snapshot, input);
	}

	function updateCard(cardId: string, patch: CardPatch): Card {
		return updateCardInStore(activeStore(false), cardId, patch);
	}

	function moveCard(input: MoveCardInput): Card {
		const snapshot = activeSnapshotWithInternals();
		if (!snapshot) throw new Error("Choose a project first");
		return moveCardInStore(activeStore(false), snapshot, input);
	}

	function updateBoard(board: Board): Board {
		const store = activeStore(false);
		writeJsonAtomic(boardPath(store.rootPath), board);
		return board;
	}

	function updateCustomFields(customFields: CustomField[]): ProjectMetadata {
		const store = activeStore(false);
		const filePath = projectMetadataPath(store.rootPath);
		const metadata = { ...readJson<ProjectMetadata>(filePath), customFields };
		writeJsonAtomic(filePath, metadata);
		return metadata;
	}

	return {
		paths: runtimePaths,
		readRegistry: registry.readRegistry,
		writeRegistry: registry.writeRegistry,
		listView,
		activeSnapshot,
		activeSnapshotWithInternals,
		chooseProjectPath,
		locateProjectPath,
		removeProject,
		switchProject,
		setStorageSearchPaths,
		setActiveWorkspaceFile,
		createCard,
		updateCard,
		updateBoard,
		updateCustomFields,
		moveCard,
		deleteCard(cardId: string) {
			return deleteCardInStore(activeStore(false), cardId);
		},
	};
}

export function stripInternalSnapshotFields(snapshot: ProjectSnapshotWithInternals | null): ProjectSnapshot | null {
	if (!snapshot) return snapshot;
	return toPublicSnapshot(snapshot);
}

function toPublicSnapshot(snapshot: ProjectSnapshotWithInternals): ProjectSnapshot {
	const { storageRoot: _storageRoot, ...publicSnapshot } = snapshot;
	return publicSnapshot;
}
