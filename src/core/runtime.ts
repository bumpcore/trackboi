import { existsSync } from "node:fs";
import { createCardInStore, deleteCardInStore, moveCardInStore, updateCardInStore } from "./cards";
import { newId } from "./id";
import { readJson, writeJsonAtomic } from "./json";
import { boardPath, projectMetadataPath, runtimePaths } from "./paths";
import { createRegistryStore, normalizeStorageSearchPaths, type RegistryOptions } from "./registry";
import {
	activeProjectFromRegistry,
	canonicalStorageKey,
	listWorkspaceSource,
	projectEntry,
} from "./sources";
import {
	canonicalProjectPath,
	openStore,
	projectName,
	resolveProjectStorage,
	storageCandidates,
	type ProjectStore,
} from "./storage";
import {
	createTrackInStore,
	deleteTrackFileInStore,
	deleteTrackInStore,
	readTrackFileInStore,
	updateTrackInStore,
	writeTrackFileInStore,
} from "./tracks";
import { aggregateSnapshot as aggregateRuntimeSnapshot, stripInternalSnapshotFields, withSelectedWorktree } from "./services/runtimeAggregation";
import { readSnapshotForProjectPath } from "./services/runtimeSnapshots";
import type { CachedDesktopState, WorktreeStore } from "./services/runtimeTypes";
import {
	createSelectedWorktreeStore as promoteWorktreeStore,
	discoverWorktrees as discoverProjectWorktrees,
	pickSelectedWorktree,
	projectCacheKey,
	stripProjectFromWorktree,
} from "./services/runtimeWorktrees";
import type {
	Board,
	Card,
	CardPatch,
	CreateTrackInput,
	CreateCardInput,
	CustomField,
	DesktopState,
	MoveCardInput,
	Project,
	ProjectMetadata,
	ProjectSnapshot,
	ProjectSnapshotWithInternals,
	ProjectSource,
	ProjectView,
	Track,
	TrackFile,
	TrackFileReadResult,
	TrackFileWriteInput,
	TrackPatch,
	TrackboiRuntime,
} from "./types";
import { normalizeProjectMetadata } from "./storage";

export type RuntimeOptions = RegistryOptions;

/**
 * Creates the public Trackboi core API.
 *
 * Electron, CLI, and MCP should all enter through this facade so filesystem
 * writes stay consistent regardless of which client initiated an action.
 */
export function createRuntime(options: RuntimeOptions = {}): TrackboiRuntime {
	const registry = createRegistryStore(options);
	let desktopCache: CachedDesktopState | null = null;
	const snapshotCache = new Map<string, ProjectSnapshotWithInternals>();
	const worktreeCache = new Map<string, WorktreeStore[]>();

	function invalidateCache(): void {
		desktopCache = null;
		snapshotCache.clear();
		worktreeCache.clear();
	}

	function readSnapshotForPath(project: Project, projectPath: string, create: boolean): ProjectSnapshotWithInternals | null {
		return readSnapshotForProjectPath({
			project: {
				...project,
				path: projectPath,
				storagePath: undefined,
			},
			projectPath,
			create,
			readRegistry: registry.readRegistry,
			writeRegistry: registry.writeRegistry,
			snapshotCache,
		});
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
		return discoverProjectWorktrees({
			project,
			readRegistry: registry.readRegistry,
			worktreeCache,
		});
	}

	function pickCurrentWorktree(worktrees: WorktreeStore[]): WorktreeStore | null {
		return pickSelectedWorktree(worktrees, registry.readRegistry().selectedWorktreeId);
	}

	function toStoredCardPatch(
		patch: CardPatch,
		trackId: string | null,
	): CardPatch {
		const nextPatch: CardPatch = { ...patch, trackId, scope: { kind: "project", ref: "global" } };
		return nextPatch;
	}

	function aggregateSnapshot(project: Project, create: boolean): { snapshotBase: ProjectSnapshotWithInternals | null; worktrees: WorktreeStore[] } {
		return aggregateRuntimeSnapshot({
			project,
			create,
			discoverWorktrees,
			pickSelectedWorktree: pickCurrentWorktree,
			createSelectedWorktreeStore: (activeProject, worktree) => (
				promoteWorktreeStore({
					project: activeProject,
					worktree,
					readSnapshotForPath,
				})
			),
			readSnapshotForPath,
		});
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
		return withSelectedWorktree(cached.snapshotBase, pickCurrentWorktree(cached.worktrees));
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
		let selected = explicit ?? pickCurrentWorktree(worktrees);
		if (!selected) throw new Error("No worktree available for this project");
		if (selected.status !== "ready") {
			selected = promoteWorktreeStore({
				project,
				worktree: selected,
				readSnapshotForPath,
			});
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

	function listTracks(): Track[] {
		return activeSnapshot()?.tracks ?? [];
	}

	function getTrack(trackId: string): Track {
		const track = listTracks().find((candidate) => candidate.id === trackId);
		if (!track) throw new Error(`Unknown track: ${trackId}`);
		return track;
	}

	function findTrackOrigin(trackId: string): { worktreeId: string; worktreePath: string } {
		const project = requireActiveProject();
		const track = getTrack(trackId);
		if (!track.originWorktreeId) throw new Error(`Unknown track origin for ${trackId}`);
		const worktree = discoverWorktrees(project).find((candidate) => candidate.id === track.originWorktreeId);
		if (!worktree) throw new Error(`Unknown track origin for ${trackId}`);
		return { worktreeId: worktree.id, worktreePath: worktree.path };
	}

	function findExistingBranchTrack(ref: string): Track | null {
		return listTracks().find((track) => track.source.kind === "branch" && track.source.ref === ref && !track.synthetic) ?? null;
	}

	function materializeBranchTrack(ref: string, title = ref): Track {
		const existing = findExistingBranchTrack(ref);
		if (existing) return existing;

			const created = createTrackInStore(openTargetStore(null, true), {
				title,
				source: { kind: "branch", ref },
			});
		invalidateCache();
		return created;
	}

	function ensureTrackIdForCardInput(input: { trackId?: string | null; scope?: CardPatch["scope"] }, fallbackTitle?: string): string | null {
		if (input.trackId) {
			if (input.trackId.startsWith("synthetic-track:")) {
				const synthetic = getTrack(input.trackId);
				if (synthetic.source.kind === "branch") {
					return materializeBranchTrack(synthetic.source.ref, synthetic.title).id;
				}
			}
			return input.trackId;
		}
		if (input.scope?.kind === "track") {
			return materializeBranchTrack(input.scope.ref, fallbackTitle ?? input.scope.ref).id;
		}
		return null;
	}

	function createTrack(input: CreateTrackInput): Track {
		if (input.source?.kind === "branch") {
			return materializeBranchTrack(input.source.ref, input.title);
		}
		const track = createTrackInStore(openTargetStore(null, true), input);
		invalidateCache();
		return track;
	}

	function updateTrack(trackId: string, patch: TrackPatch): Track {
		const track = getTrack(trackId);
		if (track.synthetic && track.source.kind === "branch") {
			const realTrack = materializeBranchTrack(track.source.ref, patch.title ?? track.title);
			return patch.title === undefined &&
				patch.summary === undefined &&
				patch.plan === undefined &&
				patch.decisions === undefined &&
				patch.references === undefined &&
				patch.activity === undefined &&
				patch.source === undefined
				? realTrack
				: updateTrack(realTrack.id, patch);
		}

		const project = requireActiveProject();
		const origin = findTrackOrigin(trackId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const next = updateTrackInStore(store, trackId, patch);
		invalidateCache();
		return next;
	}

	function deleteTrack(trackId: string): { ok: true } {
		const project = requireActiveProject();
		const track = getTrack(trackId);
		const worktrees = discoverWorktrees(project);

		for (const worktree of worktrees) {
			if (!worktree.storageRoot) continue;
			const snapshot = readSnapshotForPath(project, worktree.path, false);
			if (!snapshot) continue;
			const store = openStore({
				...project,
				path: worktree.path,
				storagePath: undefined,
			}, registry.readRegistry(), false);
			for (const card of snapshot.cards) {
				const matchesRealTrack = card.trackId === trackId;
				const matchesLegacyBranch = !card.trackId &&
					track.source.kind === "branch" &&
					card.scope.kind === "track" &&
					card.scope.ref === track.source.ref;
				if (!matchesRealTrack && !matchesLegacyBranch) continue;
				updateCardInStore(store, card.id, {
					trackId: null,
					scope: { kind: "project", ref: "global" },
				});
			}
		}

		if (!track.synthetic) {
			const origin = findTrackOrigin(trackId);
			const store = openStore({
				...project,
				path: origin.worktreePath,
				storagePath: undefined,
			}, registry.readRegistry(), false);
			deleteTrackInStore(store, trackId);
		}

		invalidateCache();
		return { ok: true };
	}

	function readTrackFile(trackId: string, fileName: string): TrackFileReadResult {
		const project = requireActiveProject();
		const track = getTrack(trackId);
		const realTrack = track.synthetic && track.source.kind === "branch"
			? materializeBranchTrack(track.source.ref, track.title)
			: track;
		const origin = findTrackOrigin(realTrack.id);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		return readTrackFileInStore(store, realTrack.id, fileName);
	}

	function writeTrackFile(input: TrackFileWriteInput): TrackFile {
		const project = requireActiveProject();
		const track = getTrack(input.trackId);
		const realTrackId = track.synthetic && track.source.kind === "branch"
			? materializeBranchTrack(track.source.ref, track.title).id
			: track.id;
		const origin = findTrackOrigin(realTrackId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const file = writeTrackFileInStore(store, { ...input, trackId: realTrackId });
		invalidateCache();
		return file;
	}

	function deleteTrackFile(trackId: string, fileName: string): { ok: true } {
		const project = requireActiveProject();
		const track = getTrack(trackId);
		const realTrackId = track.synthetic && track.source.kind === "branch"
			? materializeBranchTrack(track.source.ref, track.title).id
			: track.id;
		const origin = findTrackOrigin(realTrackId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const result = deleteTrackFileInStore(store, realTrackId, fileName);
		invalidateCache();
		return result;
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
			return stripInternalSnapshotFields(
				readSnapshotForPath(existing, canonicalPath, true) ?? aggregateSnapshot(existing, true).snapshotBase!,
			)!;
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
		return stripInternalSnapshotFields(aggregateSnapshot(project, true).snapshotBase)!;
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
		return stripInternalSnapshotFields(aggregateSnapshot(project, true).snapshotBase)!;
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
		const trackId = ensureTrackIdForCardInput(input, input.title);
		const card = createCardInStore(openTargetStore(worktree.id, true), snapshot, {
			...input,
			trackId,
			scope: { kind: "project", ref: "global" },
		});
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
				trackId: card.trackId,
			}],
		};
	}

	function updateCard(cardId: string, patch: CardPatch): Card {
		const project = requireActiveProject();
		const origin = findCardOrigin(cardId);
		const currentCard = activeSnapshot()?.cards.find((candidate) => candidate.id === cardId);
		const trackId = ensureTrackIdForCardInput({
			trackId: patch.trackId ?? currentCard?.trackId ?? null,
			scope: patch.scope ?? currentCard?.scope,
		}, currentCard?.title);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const card = updateCardInStore(store, cardId, toStoredCardPatch(patch, trackId));
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
		listTracks,
		getTrack,
		createTrack,
		updateTrack,
		deleteTrack,
		readTrackFile,
		writeTrackFile,
		deleteTrackFile,
		createCard,
		updateCard,
		updateBoard,
		updateCustomFields,
		moveCard,
		deleteCard,
	};
}

export { stripInternalSnapshotFields } from "./services/runtimeAggregation";
