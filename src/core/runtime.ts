import { existsSync } from "node:fs";
import { createCardInStore, deleteCardInStore, moveCardInStore, updateCardInStore } from "./cards";
import { findGitRoot, listGitWorktrees, readGitContext } from "./git";
import { newId } from "./id";
import { readJson, writeJsonAtomic } from "./json";
import { boardPath, projectMetadataPath, runtimePaths } from "./paths";
import { createRegistryStore, normalizeStorageSearchPaths, type RegistryOptions } from "./registry";
import {
	activeProjectFromRegistry,
	canonicalStorageKey,
	listWorkspaceSource,
	projectEntry,
	projectStatus,
} from "./sources";
import {
	canonicalProjectPath,
	ensureProjectFiles,
	openStore,
	normalizeBoard,
	normalizeProjectMetadata,
	projectFromMetadata,
	projectName,
	readCards,
	resolveProjectStorage,
	storageCandidates,
	type ProjectStore,
} from "./storage";
import type {
	Board,
	Card,
	CardPatch,
	CardVariant,
	CreateCardInput,
	CustomField,
	DesktopState,
	GitContext,
	MoveCardInput,
	Project,
	ProjectMetadata,
	ProjectSnapshot,
	ProjectSnapshotWithInternals,
	ProjectSource,
	ProjectView,
	TrackboiRuntime,
	WorktreeContext,
} from "./types";

export type RuntimeOptions = RegistryOptions;

type WorktreeStore = WorktreeContext & {
	project: Project;
	git: GitContext;
};

type CachedDesktopState = {
	projectKey: string;
	snapshotBase: ProjectSnapshotWithInternals | null;
	view: ProjectView;
	worktrees: WorktreeStore[];
};

type CardOrigin = {
	card: Card;
	worktree: WorktreeStore;
	storagePath: string;
};

/**
 * Creates the public Trackboi core API.
 *
 * Electron, CLI, and MCP should all enter through this facade so filesystem
 * writes stay consistent regardless of which client initiated an action.
 */
export function createRuntime(options: RuntimeOptions = {}): TrackboiRuntime {
	const registry = createRegistryStore(options);
	let desktopCache: CachedDesktopState | null = null;

	function invalidateCache(): void {
		desktopCache = null;
	}

	function projectCacheKey(project: Project): string {
		return `${project.id}:${project.path}`;
	}

	function rememberProjectStorage(projectId: string, storagePath: string): void {
		const current = registry.readRegistry();
		const project = current.projects.find((entry) => entry.id === projectId);
		if (project && project.storagePath !== storagePath) {
			project.storagePath = storagePath;
			registry.writeRegistry(current);
		}
	}

	function readSnapshotForPath(project: Project, projectPath: string, create: boolean): ProjectSnapshotWithInternals | null {
		if (!existsSync(projectPath)) return null;

		const projectForPath: Project = {
			...project,
			path: canonicalProjectPath(projectPath),
			storagePath: undefined,
		};
		const current = registry.readRegistry();
		const store = openStore(projectForPath, current, create);
		ensureProjectFiles(store.project, store.rootPath, store.storagePath);
		rememberProjectStorage(project.id, store.storagePath);

		let metadata = normalizeProjectMetadata(
			readJson<ProjectMetadata>(projectMetadataPath(store.rootPath)),
			project,
			store.storagePath,
		);
		const board = normalizeBoard(readJson<Board>(boardPath(store.rootPath)), {
			...project,
			path: projectForPath.path,
		});
		writeJsonAtomic(projectMetadataPath(store.rootPath), metadata);
		writeJsonAtomic(boardPath(store.rootPath), board);
		if (metadata.customFields.length === 0 && board.customFields.length > 0) {
			metadata = { ...metadata, customFields: board.customFields };
			writeJsonAtomic(projectMetadataPath(store.rootPath), metadata);
		}

		const nextProject = projectFromMetadata(store);
		return {
			project: nextProject,
			metadata,
			git: readGitContext(projectForPath.path),
			board,
			cards: readCards(store.rootPath),
			storageRoot: store.rootPath,
		};
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

	function discoverWorktrees(project: Project): WorktreeStore[] {
		if (!existsSync(project.path)) return [];
		const repoRoot = findGitRoot(project.path);
		const discovered = repoRoot
			? listGitWorktrees(repoRoot)
			: [{ path: project.path, branch: null, isPrimary: true }];
		const worktrees = discovered.length > 0 ? discovered : [{ path: project.path, branch: null, isPrimary: true }];

		return worktrees.map((entry) => {
			const worktreePath = canonicalProjectPath(entry.path);
			const worktreeProject: Project = {
				id: project.id,
				name: project.name,
				path: worktreePath,
				storagePath: undefined,
			};
			const resolved = resolveProjectStorage(worktreeProject, registry.readRegistry(), false);
			const status = projectStatus(worktreeProject, registry.readRegistry());
			const cardCount = resolved && existsSync(boardPath(resolved.rootPath))
				? readCards(resolved.rootPath).length
				: 0;
			const git = readGitContext(worktreePath);
			return {
				id: worktreePath,
				name: projectName(worktreePath),
				path: worktreePath,
				branch: entry.branch,
				isPrimary: entry.isPrimary,
				storagePath: resolved?.storagePath ?? null,
				storageRoot: resolved?.rootPath ?? null,
				status,
				cardCount,
				colorKey: worktreePath,
				project: worktreeProject,
				git,
			};
		});
	}

	function pickSelectedWorktree(worktrees: WorktreeStore[]): WorktreeStore | null {
		if (worktrees.length === 0) return null;
		const current = registry.readRegistry();
		const selected = current.selectedWorktreeId
			? worktrees.find((worktree) => worktree.id === current.selectedWorktreeId) ?? null
			: null;
		return selected ?? worktrees.find((worktree) => worktree.isPrimary) ?? worktrees[0] ?? null;
	}

	function createSelectedWorktreeStore(project: Project, worktree: WorktreeStore): WorktreeStore {
		const snapshot = readSnapshotForPath(project, worktree.path, true);
		if (!snapshot) return worktree;
		return {
			...worktree,
			storagePath: snapshot.project.storagePath ?? null,
			storageRoot: snapshot.storageRoot,
			status: "ready",
			cardCount: snapshot.cards.length,
		};
	}

	function mergeCardVariants(origins: CardOrigin[]): Card {
		const sortedOrigins = [...origins].sort((left, right) => {
			const updated = right.card.updatedAt.localeCompare(left.card.updatedAt);
			if (updated !== 0) return updated;
			return left.worktree.name.localeCompare(right.worktree.name);
		});
		const winner = sortedOrigins[0]!;
		const variants: CardVariant[] = sortedOrigins.map(({ card, worktree, storagePath }) => ({
			worktreeId: worktree.id,
			worktreeName: worktree.name,
			storagePath,
			updatedAt: card.updatedAt,
			title: card.title,
			description: card.description,
			column: card.column,
			scope: card.scope,
		}));
		const signatures = new Set(sortedOrigins.map(({ card }) => JSON.stringify({
			title: card.title,
			description: card.description,
			parentId: card.parentId,
			scope: card.scope,
			column: card.column,
			rank: card.rank,
			labels: card.labels,
			assignee: card.assignee,
			fieldValues: card.fieldValues,
		})));

		return {
			...winner.card,
			originWorktreeId: winner.worktree.id,
			originStoragePath: winner.storagePath,
			worktreeIds: sortedOrigins.map(({ worktree }) => worktree.id),
			conflicted: signatures.size > 1,
			variants,
		};
	}

	function aggregateSnapshot(project: Project, create: boolean): { snapshotBase: ProjectSnapshotWithInternals | null; worktrees: WorktreeStore[] } {
		if (!existsSync(project.path)) return { snapshotBase: null, worktrees: [] };

		let worktrees = discoverWorktrees(project);
		let selected = pickSelectedWorktree(worktrees);
		if (!selected) return { snapshotBase: null, worktrees: [] };

		if (create && selected.status !== "ready") {
			selected = createSelectedWorktreeStore(project, selected);
			worktrees = worktrees.map((candidate) => candidate.id === selected?.id ? selected : candidate);
		}

		const primary = worktrees.find((worktree) => worktree.isPrimary) ?? selected;
		const storeSnapshots = worktrees
			.filter((worktree) => worktree.storageRoot && existsSync(boardPath(worktree.storageRoot)))
			.map((worktree) => {
				const storeSnapshot = readSnapshotForPath(project, worktree.path, false);
				return storeSnapshot ? { worktree, snapshot: storeSnapshot } : null;
			})
			.filter((entry): entry is { worktree: WorktreeStore; snapshot: ProjectSnapshotWithInternals } => entry != null);
		const primarySnapshot = storeSnapshots.find((entry) => entry.worktree.id === primary?.id)?.snapshot
			?? storeSnapshots[0]?.snapshot
			?? readSnapshotForPath(project, selected.path, create);
		if (!primarySnapshot) return { snapshotBase: null, worktrees };

		const columns = [...primarySnapshot.board.columns];
		const seenColumnIds = new Set(columns.map((column) => column.id));
		for (const entry of storeSnapshots) {
			for (const column of entry.snapshot.board.columns) {
				if (seenColumnIds.has(column.id)) continue;
				seenColumnIds.add(column.id);
				columns.push(column);
			}
		}

		const cardsById = new Map<string, CardOrigin[]>();
		for (const entry of storeSnapshots) {
			for (const card of entry.snapshot.cards) {
				const storagePath = entry.worktree.storagePath ?? ".trackboi";
				const origins = cardsById.get(card.id) ?? [];
				origins.push({ card, worktree: entry.worktree, storagePath });
				cardsById.set(card.id, origins);
			}
		}

		const aggregatedCards = [...cardsById.values()]
			.map((origins) => mergeCardVariants(origins))
			.sort((left, right) => left.column.localeCompare(right.column) || left.rank.localeCompare(right.rank));

		return {
			snapshotBase: {
			project: primarySnapshot.project,
			metadata: primarySnapshot.metadata,
			git: primary.git,
			board: {
				...primarySnapshot.board,
				name: primarySnapshot.board.name,
				columns,
			},
			cards: aggregatedCards,
			storageRoot: primary.storageRoot ?? primarySnapshot.storageRoot,
			},
			worktrees,
		};
	}

	function getCachedDesktopState(create: boolean): CachedDesktopState {
		const project = activeProjectFromRegistry(registry.readRegistry());
		const view = listView();
		if (!project || !existsSync(project.path)) {
			return {
				projectKey: "none",
				snapshotBase: null,
				view,
				worktrees: [],
			};
		}

		const cacheKey = projectCacheKey(project);
		if (desktopCache && desktopCache.projectKey === cacheKey) {
			return {
				...desktopCache,
				view,
			};
		}

		const aggregated = aggregateSnapshot(project, create);
		desktopCache = {
			projectKey: cacheKey,
			snapshotBase: aggregated.snapshotBase,
			view,
			worktrees: aggregated.worktrees,
		};
		return desktopCache;
	}

	function toDesktopState(cached: CachedDesktopState): DesktopState {
		const current = registry.readRegistry();
		const selected = current.selectedWorktreeId
			? cached.worktrees.find((worktree) => worktree.id === current.selectedWorktreeId) ?? null
			: null;
		const fallback = selected ?? cached.worktrees.find((worktree) => worktree.isPrimary) ?? cached.worktrees[0] ?? null;
		const selectedWorktreeId = fallback?.id ?? null;
		if (current.selectedWorktreeId !== selectedWorktreeId) {
			current.selectedWorktreeId = selectedWorktreeId;
			registry.writeRegistry(current);
		}

		return {
			snapshot: withSelectedWorktree(cached.snapshotBase, fallback),
			view: cached.view,
			worktrees: cached.worktrees.map(stripProjectFromWorktree),
			selectedWorktreeId,
		};
	}

	function activeSnapshotWithInternals(): ProjectSnapshotWithInternals | null {
		const cached = getCachedDesktopState(true);
		return withSelectedWorktree(cached.snapshotBase, pickSelectedWorktree(cached.worktrees));
	}

	function activeSnapshot(): ProjectSnapshot | null {
		return stripInternalSnapshotFields(activeSnapshotWithInternals());
	}

	function readDesktopState(): DesktopState {
		return toDesktopState(getCachedDesktopState(true));
	}

	function setSelectedWorktree(worktreeId: string | null): DesktopState {
		const current = registry.readRegistry();
		current.selectedWorktreeId = worktreeId;
		registry.writeRegistry(current);
		return toDesktopState(getCachedDesktopState(true));
	}

	function requireActiveProject(): Project {
		const project = activeProjectFromRegistry(registry.readRegistry());
		if (!project) throw new Error("Choose a project first");
		return project;
	}

	function requireSelectedWorktree(targetWorktreeId?: string | null): WorktreeStore {
		const project = requireActiveProject();
		let worktrees = discoverWorktrees(project);
		const explicit = targetWorktreeId
			? worktrees.find((worktree) => worktree.id === targetWorktreeId) ?? null
			: null;
		let selected = explicit ?? pickSelectedWorktree(worktrees);
		if (!selected) throw new Error("No worktree available for this project");
		if (selected.status !== "ready") {
			selected = createSelectedWorktreeStore(project, selected);
			worktrees = worktrees.map((candidate) => candidate.id === selected?.id ? selected : candidate);
		}
		const current = registry.readRegistry();
		if (current.selectedWorktreeId !== selected.id) {
			current.selectedWorktreeId = selected.id;
			registry.writeRegistry(current);
		}
		if (desktopCache) {
			desktopCache.worktrees = desktopCache.worktrees.map((candidate) => candidate.id === selected?.id ? selected : candidate);
		}
		return selected;
	}

	function openTargetStore(targetWorktreeId?: string | null, create = false): ProjectStore {
		const project = requireActiveProject();
		const worktree = requireSelectedWorktree(targetWorktreeId);
		return openStore({
			...project,
			path: worktree.path,
			storagePath: undefined,
		}, registry.readRegistry(), create);
	}

	function findCardOrigin(cardId: string): { worktreeId: string; worktreePath: string } {
		const project = requireActiveProject();
		const snapshot = activeSnapshot();
		const card = snapshot?.cards.find((candidate) => candidate.id === cardId);
		if (!card?.originWorktreeId) throw new Error(`Unknown card: ${cardId}`);
		const worktree = discoverWorktrees(project).find((candidate) => candidate.id === card.originWorktreeId);
		if (!worktree) throw new Error(`Unknown card origin for ${cardId}`);
		return { worktreeId: worktree.id, worktreePath: worktree.path };
	}

	function chooseProjectPath(projectPath: string): ProjectSnapshot {
		const canonicalPath = canonicalProjectPath(projectPath);
		const current = registry.readRegistry();
		const existing = current.projects.find((project) => project.path === canonicalPath);
		if (existing) {
			current.activeProjectId = existing.id;
			current.selectedWorktreeId = canonicalPath;
			registry.writeRegistry(current);
			invalidateCache();
			return toPublicSnapshot(readSnapshotForPath(existing, canonicalPath, true) ?? aggregateSnapshot(existing, true).snapshotBase!);
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
		current.selectedWorktreeId = canonicalPath;
		registry.writeRegistry(current);
		invalidateCache();
		return toPublicSnapshot(aggregateSnapshot(project, true).snapshotBase!);
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
		current.selectedWorktreeId = canonicalPath;
		registry.writeRegistry(current);
		invalidateCache();
		return toPublicSnapshot(aggregateSnapshot(project, true).snapshotBase!);
	}

	function removeProject(projectId: string): ProjectSnapshot | null {
		const current = registry.readRegistry();
		const previousLength = current.projects.length;
		current.projects = current.projects.filter((project) => project.id !== projectId);
		if (current.projects.length === previousLength) throw new Error(`Unknown project: ${projectId}`);
		if (current.activeProjectId === projectId) {
			current.activeProjectId = current.projects[0]?.id ?? null;
			current.selectedWorktreeId = current.projects[0]?.path ?? null;
		}
		registry.writeRegistry(current);
		invalidateCache();
		return activeSnapshot();
	}

	function switchProject(projectId: string): ProjectSnapshot | null {
		const current = registry.readRegistry();
		const entry = listView().sources
			.flatMap((source) => source.entries)
			.find((candidate) => candidate.projectId === projectId);
		if (!entry) throw new Error(`Unknown project: ${projectId}`);
		current.activeProjectId = projectId;
		current.selectedWorktreeId = entry.path;
		registry.writeRegistry(current);
		invalidateCache();
		return activeSnapshot();
	}

	function setStorageSearchPaths(paths: string[]): ProjectView {
		const current = registry.readRegistry();
		current.storageSearchPaths = normalizeStorageSearchPaths(paths);
		registry.writeRegistry(current);
		invalidateCache();
		return listView();
	}

	function setActiveWorkspaceFile(filePath: string | null): ProjectView {
		const current = registry.readRegistry();
		current.activeWorkspaceFile = filePath || null;
		registry.writeRegistry(current);
		invalidateCache();
		return listView();
	}

	function createCard(input: CreateCardInput): Card {
		const project = requireActiveProject();
		const worktree = requireSelectedWorktree(input.targetWorktreeId);
		const snapshot = readSnapshotForPath(project, worktree.path, true);
		if (!snapshot) throw new Error("Choose a project first");
		const card = createCardInStore(openTargetStore(worktree.id, true), snapshot, input);
		invalidateCache();
		return {
			...card,
			originWorktreeId: worktree.id,
			originStoragePath: worktree.storagePath ?? undefined,
			worktreeIds: [worktree.id],
			conflicted: false,
			variants: [{
				worktreeId: worktree.id,
				worktreeName: worktree.name,
				storagePath: worktree.storagePath ?? ".trackboi",
				updatedAt: card.updatedAt,
				title: card.title,
				description: card.description,
				column: card.column,
				scope: card.scope,
			}],
		};
	}

	function updateCard(cardId: string, patch: CardPatch): Card {
		const project = requireActiveProject();
		const origin = findCardOrigin(cardId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const card = updateCardInStore(store, cardId, patch);
		invalidateCache();
		return card;
	}

	function moveCard(input: MoveCardInput): Card {
		const project = requireActiveProject();
		const origin = findCardOrigin(input.cardId);
		const snapshot = readSnapshotForPath(project, origin.worktreePath, false);
		if (!snapshot) throw new Error(`Unknown card origin for ${input.cardId}`);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const card = moveCardInStore(store, snapshot, input);
		invalidateCache();
		return card;
	}

	function updateBoard(board: Board): Board {
		const store = openTargetStore(null, true);
		writeJsonAtomic(boardPath(store.rootPath), board);
		invalidateCache();
		return board;
	}

	function updateCustomFields(customFields: CustomField[]): ProjectMetadata {
		const store = openTargetStore(null, true);
		const filePath = projectMetadataPath(store.rootPath);
		const metadata = normalizeProjectMetadata(readJson<ProjectMetadata>(filePath), store.project, store.storagePath);
		const nextMetadata = { ...metadata, customFields };
		writeJsonAtomic(filePath, nextMetadata);
		invalidateCache();
		return nextMetadata;
	}

	function deleteCard(cardId: string): { ok: true } {
		const project = requireActiveProject();
		const origin = findCardOrigin(cardId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const result = deleteCardInStore(store, cardId);
		invalidateCache();
		return result;
	}

	return {
		paths: runtimePaths,
		readRegistry: registry.readRegistry,
		writeRegistry: registry.writeRegistry,
		listView,
		activeSnapshot,
		activeSnapshotWithInternals,
		readDesktopState,
		invalidateCache,
		setSelectedWorktree,
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
		deleteCard,
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

function withSelectedWorktree(
	snapshot: ProjectSnapshotWithInternals | null,
	selectedWorktree: WorktreeStore | null,
): ProjectSnapshotWithInternals | null {
	if (!snapshot || !selectedWorktree) return snapshot;
	return {
		...snapshot,
		git: selectedWorktree.git,
		storageRoot: selectedWorktree.storageRoot ?? snapshot.storageRoot,
	};
}

function stripProjectFromWorktree(worktree: WorktreeStore): WorktreeContext {
	const { project: _project, git: _git, ...publicWorktree } = worktree;
	return publicWorktree;
}
