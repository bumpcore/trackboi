import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { addCardCommentInStore, createCardInStore, deleteCardInStore, moveCardInStore, requireBoardColumn, updateCardInStore } from "./cards";
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
	defaultColumns,
	openStore,
	projectName,
	readCards,
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
import { aggregateSnapshot as aggregateRuntimeSnapshot, stripInternalSnapshotFields } from "./services/runtimeAggregation";
import { readSnapshotForProjectPath } from "./services/runtimeSnapshots";
import type { CachedDesktopState, DesktopStateCache, WorktreeStore } from "./services/runtimeTypes";
import {
	createSelectedWorktreeStore as promoteWorktreeStore,
	discoverWorktrees as discoverProjectWorktrees,
	pickSelectedWorktree,
	projectCacheKey,
	stripProjectFromWorktree,
} from "./services/runtimeWorktrees";
import type {
	AgentRegistration,
	AppSettings,
	Board,
	BoardDescriptor,
	Card,
	CardComment,
	CardPatch,
	CreateCardCommentInput,
	CreateCardInput,
	CreateBoardInput,
	CreateTrackInput,
	DesktopState,
	GitChanges,
	GitCommitInput,
	GitCommitResult,
	GitIdentity,
	MoveCardInput,
	PersonAlias,
	Project,
	ProjectMetadata,
	ProjectSettingsPatch,
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
	WorkScope,
} from "./types";
import { normalizeProjectMetadata } from "./storage";
import { commitGitChanges as commitRepoGitChanges, listGitChanges as listRepoGitChanges, readGitIdentity } from "./git";

export type RuntimeOptions = RegistryOptions;

/**
 * Creates the public Trackboi core API.
 *
 * Electron, CLI, and MCP should all enter through this facade so filesystem
 * writes stay consistent regardless of which client initiated an action.
 */
export function createRuntime(options: RuntimeOptions = {}): TrackboiRuntime {
	const registry = createRegistryStore(options);
	const desktopStateCache: DesktopStateCache = new Map();
	const snapshotCache = new Map<string, ProjectSnapshotWithInternals>();
	const worktreeCache = new Map<string, WorktreeStore[]>();
	let projectViewCache: ProjectView | null = null;

	function invalidateSnapshotCaches(): void {
		desktopStateCache.clear();
		snapshotCache.clear();
	}

	function invalidateAllCaches(): void {
		invalidateSnapshotCaches();
		worktreeCache.clear();
		projectViewCache = null;
	}

	function invalidateProjectDesktopState(projectPath: string): void {
		desktopStateCache.delete(projectPath);
	}

	function invalidateProjectWorktrees(projectPath: string): void {
		worktreeCache.delete(projectPath);
	}

	function invalidateProjectState(projectPath: string, options: {
		rootPath?: string | null;
		worktrees?: boolean;
		view?: boolean;
	} = {}): void {
		invalidateProjectDesktopState(projectPath);
		if (options.rootPath) snapshotCache.delete(options.rootPath);
		if (options.worktrees) invalidateProjectWorktrees(projectPath);
		if (options.view) projectViewCache = null;
	}

	function invalidateCache(): void {
		invalidateSnapshotCaches();
	}

	function invalidateStorageRoot(rootPath: string): void {
		snapshotCache.delete(rootPath);
		projectViewCache = null;
		for (const [projectKey, worktrees] of worktreeCache.entries()) {
			if (!worktrees.some((worktree) => worktree.storageRoot === rootPath)) continue;
			desktopStateCache.delete(projectKey);
			worktreeCache.delete(projectKey);
		}
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
		if (projectViewCache) return projectViewCache;
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

		projectViewCache = {
			sources,
			activeProjectPath: current.activeProjectPath,
			storageSearchPaths: storageCandidates(current),
		};
		return projectViewCache;
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

	function visibleProjects(): Project[] {
		const seen = new Set<string>();

		return listView().sources
			.flatMap((source) => source.entries)
			.filter((entry) => {
				if (seen.has(entry.projectPath)) return false;
				seen.add(entry.projectPath);
				return true;
			})
			.map((entry) => ({
				name: entry.name,
				path: entry.path,
				storagePath: entry.storagePath,
			}));
	}

	function resolveVisibleProject(projectPath: string): Project | null {
		return visibleProjects().find((project) => project.path === projectPath) ?? null;
	}

	function toStoredCardPatch(
		patch: CardPatch,
		trackId: string | null,
	): CardPatch {
		const nextPatch: CardPatch = { ...patch, trackId };
		return nextPatch;
	}

	function aggregateSnapshot(project: Project, create: boolean): { snapshotBase: ProjectSnapshotWithInternals | null; worktrees: WorktreeStore[] } {
		return aggregateRuntimeSnapshot({
			project,
			create,
			selectedBoardId: registry.readRegistry().selectedBoardId,
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
		const current = registry.readRegistry();
		const project = activeProjectFromRegistry(current);
		const view = listView();
		const selectedBoardId = current.selectedBoardId;
		const selectedWorktreeId = current.selectedWorktreeId;
		if (!project || !existsSync(project.path)) {
			return {
				projectKey: "none",
				selectedBoardId,
				selectedWorktreeId,
				snapshotBase: null,
				view,
				worktrees: [],
			};
		}

		const cacheKey = projectCacheKey(project);
		const cached = desktopStateCache.get(cacheKey);
		if (
			cached &&
			cached.selectedBoardId === selectedBoardId &&
			cached.selectedWorktreeId === selectedWorktreeId
		) {
			return {
				...cached,
				view,
			};
		}

		const aggregated = aggregateSnapshot(project, create);
		const nextCachedState = {
			projectKey: cacheKey,
			selectedBoardId,
			selectedWorktreeId,
			snapshotBase: aggregated.snapshotBase,
			view,
			worktrees: aggregated.worktrees,
		};
		desktopStateCache.set(cacheKey, nextCachedState);
		return nextCachedState;
	}

	function toDesktopState(cached: CachedDesktopState): DesktopState {
		const current = registry.readRegistry();
		const selected = current.selectedWorktreeId
			? cached.worktrees.find((worktree) => worktree.id === current.selectedWorktreeId) ?? null
			: null;
		const fallback = selected ?? cached.worktrees.find((worktree) => worktree.isPrimary) ?? cached.worktrees[0] ?? null;
		const selectedWorktreeId = fallback?.id ?? null;
		const selectedBoardId = cached.snapshotBase?.board.id ?? null;
		if (current.selectedWorktreeId !== selectedWorktreeId) current.selectedWorktreeId = selectedWorktreeId;
		if (current.selectedBoardId !== selectedBoardId) current.selectedBoardId = selectedBoardId;
		registry.writeRegistry(current);

		return {
			snapshot: cached.snapshotBase,
			view: cached.view,
			worktrees: cached.worktrees.map(stripProjectFromWorktree),
			selectedWorktreeId,
			selectedBoardId,
		};
	}

	function activeSnapshotWithInternals(): ProjectSnapshotWithInternals | null {
		const cached = getCachedDesktopState(true);
		return cached.snapshotBase;
	}

	function activeSnapshot(): ProjectSnapshot | null {
		return stripInternalSnapshotFields(activeSnapshotWithInternals());
	}

	function readDesktopState(): DesktopState {
		return toDesktopState(getCachedDesktopState(true));
	}

	/**
	 * Warms visible project snapshots in the background so later project switches
	 * can reuse already-aggregated board/worktree state.
	 */
	function prewarmProjects(): void {
		const view = listView();
		for (const project of visibleProjects()) {
			if (!existsSync(project.path)) continue;
			const cacheKey = projectCacheKey(project);
			if (desktopStateCache.has(cacheKey)) continue;

				const aggregated = aggregateSnapshot(project, false);
				desktopStateCache.set(cacheKey, {
					projectKey: cacheKey,
					selectedBoardId: registry.readRegistry().selectedBoardId,
					selectedWorktreeId: registry.readRegistry().selectedWorktreeId,
					snapshotBase: aggregated.snapshotBase,
					view,
					worktrees: aggregated.worktrees,
				});
		}
	}

	function setSelectedWorktree(worktreeId: string | null): DesktopState {
		const current = registry.readRegistry();
		current.selectedWorktreeId = worktreeId;
		registry.writeRegistry(current);
		return toDesktopState(getCachedDesktopState(true));
	}

	function listBoards(): BoardDescriptor[] {
		return activeSnapshot()?.boards ?? [];
	}

	function setActiveBoard(boardId: string): DesktopState {
		const current = registry.readRegistry();
		current.selectedBoardId = boardId;
		registry.writeRegistry(current);
		return toDesktopState(getCachedDesktopState(true));
	}

	function readAppSettings(): AppSettings {
		return registry.readRegistry().appSettings;
	}

	function updateAppSettings(settings: AppSettings): AppSettings {
		const current = registry.readRegistry();
		current.appSettings = settings;
		registry.writeRegistry(current);
		projectViewCache = null;
		return current.appSettings;
	}

	function defaultGitCommitPaths(snapshot: ProjectSnapshotWithInternals): string[] {
		if (!snapshot.git.root) return [];
		const relativeStoragePath = path.relative(snapshot.git.root, snapshot.storageRoot);
		if (!relativeStoragePath || relativeStoragePath.startsWith("..") || path.isAbsolute(relativeStoragePath)) return [];
		return [relativeStoragePath];
	}

	function resolveGitCommitPaths(snapshot: ProjectSnapshotWithInternals, paths?: string[]): string[] {
		const requestedPaths = paths?.map((entry) => entry.trim()).filter(Boolean);
		return requestedPaths && requestedPaths.length > 0 ? requestedPaths : defaultGitCommitPaths(snapshot);
	}

	function requireGitSnapshot(): ProjectSnapshotWithInternals {
		const snapshot = activeSnapshotWithInternals();
		if (!snapshot) throw new Error("Choose a project first");
		if (!snapshot.git.isGitRepo || !snapshot.git.root) throw new Error("Active project is not a git repository");
		return snapshot;
	}

	function listGitChanges(paths?: string[]): GitChanges {
		const snapshot = requireGitSnapshot();
		const resolvedPaths = resolveGitCommitPaths(snapshot, paths);
		if (resolvedPaths.length === 0) throw new Error("No trackboi-managed paths are inside the git repository");
		const result = listRepoGitChanges(snapshot.git.root!, resolvedPaths);
		return {
			...result,
			defaultPaths: defaultGitCommitPaths(snapshot),
		};
	}

	function commitGitChanges(input: GitCommitInput): GitCommitResult {
		const snapshot = requireGitSnapshot();
		const resolvedPaths = resolveGitCommitPaths(snapshot, input.paths);
		if (resolvedPaths.length === 0) throw new Error("No trackboi-managed paths are inside the git repository");
		const result = commitRepoGitChanges(snapshot.git.root!, input.message, resolvedPaths);
		invalidateCache();
		return result;
	}

	function updateProjectSettings(patch: ProjectSettingsPatch): ProjectMetadata {
		const store = openTargetStore(true);
		const filePath = projectMetadataPath(store.rootPath);
		const metadata = normalizeProjectMetadata(readJson<ProjectMetadata>(filePath), store.project, store.storagePath);
		const nextMetadata: ProjectMetadata = {
			...metadata,
			color: typeof patch.color === "string" && patch.color.trim() ? patch.color.trim() : null,
			iconPath: typeof patch.iconPath === "string" && patch.iconPath.trim() ? patch.iconPath.trim() : null,
		};
		writeJsonAtomic(filePath, nextMetadata);
		invalidateProjectState(store.project.path, {
			rootPath: store.rootPath,
			worktrees: true,
			view: true,
		});
		return nextMetadata;
	}

	function requireActiveProject(): Project {
		const project = activeProjectFromRegistry(registry.readRegistry());
		if (!project) throw new Error("Choose a project first");
		return project;
	}

	function requireActiveBoard(): Board {
		const board = activeSnapshotWithInternals()?.board;
		if (!board) throw new Error("Choose a board first");
		return board;
	}

	function requireSelectedWorktree(): WorktreeStore {
		const project = requireActiveProject();
		let worktrees = discoverWorktrees(project);
		let selected = pickCurrentWorktree(worktrees);
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
		const cacheKey = projectCacheKey(project);
		const cached = desktopStateCache.get(cacheKey);
		if (cached) {
			cached.worktrees = cached.worktrees.map((candidate) => candidate.id === selected?.id ? selected : candidate);
		}
		return selected;
	}

	function resolveDesktopActorId(store: ProjectStore, worktreePath: string, explicitActorId?: string): string {
		if (explicitActorId) {
			ensureProjectAgentRegistration(store, explicitActorId);
			return explicitActorId;
		}
		const identity = readGitIdentity(worktreePath);
		if (!identity) return "person_unknown";
		return ensurePersonAlias(store, identity).id;
	}

	function ensureProjectAgentRegistration(store: ProjectStore, agentId: string): void {
		const registryAgent = registry.readRegistry().appSettings.agents.find((agent) => agent.id === agentId);
		if (!registryAgent) return;

		const metadataPath = projectMetadataPath(store.rootPath);
		const metadata = normalizeProjectMetadata(readJson<ProjectMetadata>(metadataPath), store.project, store.storagePath);
		const existing = metadata.agents.find((agent) => agent.id === registryAgent.id);
		const nextAgent: AgentRegistration = {
			id: registryAgent.id,
			name: registryAgent.name,
			description: registryAgent.description,
		};
		if (
			existing &&
			existing.name === nextAgent.name &&
			existing.description === nextAgent.description
		) {
			return;
		}

		writeJsonAtomic(metadataPath, {
			...metadata,
			agents: existing
				? metadata.agents.map((agent) => agent.id === nextAgent.id ? nextAgent : agent)
				: [...metadata.agents, nextAgent],
		});
	}

	function ensurePersonAlias(store: ProjectStore, identity: GitIdentity): PersonAlias {
		const metadataPath = projectMetadataPath(store.rootPath);
		const metadata = normalizeProjectMetadata(readJson<ProjectMetadata>(metadataPath), store.project, store.storagePath);
		const normalizedEmail = identity.email.trim().toLowerCase();
		const normalizedName = identity.name.trim();
		const existing = metadata.people.find((person) => (
			(normalizedEmail && person.gitEmails.some((email) => email.toLowerCase() === normalizedEmail)) ||
			(!normalizedEmail && normalizedName && person.gitNames.some((name) => name === normalizedName))
		));
		if (existing) return existing;

		const created: PersonAlias = {
			id: newId("person"),
			displayName: normalizedName || normalizedEmail || "Unknown person",
			gitEmails: normalizedEmail ? [normalizedEmail] : [],
			gitNames: normalizedName ? [normalizedName] : [],
		};
		metadata.people = [...metadata.people, created];
		writeJsonAtomic(metadataPath, metadata);
		return created;
	}

	function openTargetStore(create = false): ProjectStore {
		const project = requireActiveProject();
		const worktree = requireSelectedWorktree();
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

	function materializeBranchTrack(ref: string, title = ref): Track {
		const store = openTargetStore(true);
		const created = createTrackInStore(store, {
			title,
			summary: `Legacy branch context: ${ref}`,
		});
		invalidateProjectState(requireActiveProject().path, { rootPath: store.rootPath });
		return created;
	}

	function ensureTrackIdForCardInput(input: { trackId?: string | null; legacyScope?: WorkScope }, fallbackTitle?: string): string | null {
		if (input.trackId) {
			if (input.trackId.startsWith("synthetic-track:")) {
				const synthetic = getTrack(input.trackId);
				if (synthetic.syntheticRef) {
					return materializeBranchTrack(synthetic.syntheticRef, synthetic.title).id;
				}
			}
			return input.trackId;
		}
		if (input.legacyScope?.kind === "track") {
			return materializeBranchTrack(input.legacyScope.ref, fallbackTitle ?? input.legacyScope.ref).id;
		}
		return null;
	}

	function createTrack(input: CreateTrackInput): Track {
		const project = requireActiveProject();
		const store = openTargetStore(true);
		const worktree = requireSelectedWorktree();
		const track = createTrackInStore(store, {
			...input,
			actorId: resolveDesktopActorId(store, worktree.path, input.actorId),
		});
		invalidateProjectState(project.path, { rootPath: store.rootPath });
		return track;
	}

	function updateTrack(trackId: string, patch: TrackPatch): Track {
		const track = getTrack(trackId);
		if (track.synthetic && track.syntheticRef) {
			const realTrack = materializeBranchTrack(track.syntheticRef, patch.title ?? track.title);
			return patch.title === undefined &&
				patch.summary === undefined &&
				patch.brief === undefined &&
				patch.decisions === undefined &&
				patch.references === undefined
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
		const next = updateTrackInStore(store, trackId, {
			...patch,
			actorId: resolveDesktopActorId(store, origin.worktreePath, patch.actorId),
		});
		invalidateProjectState(project.path, { rootPath: store.rootPath });
		return next;
	}

	function deleteTrack(trackId: string): { ok: true } {
		const project = requireActiveProject();
		const track = getTrack(trackId);
		const selectedWorktree = requireSelectedWorktree();
		const selectedSnapshot = readSnapshotForPath(project, selectedWorktree.path, false);
		if (selectedSnapshot) {
			const store = openStore({
				...project,
				path: selectedWorktree.path,
				storagePath: undefined,
			}, registry.readRegistry(), false);
			for (const card of selectedSnapshot.cards) {
				const matchesRealTrack = card.trackId === trackId;
				const matchesLegacyBranch = !card.trackId &&
					track.syntheticRef &&
					card.scope.kind === "track" &&
					card.scope.ref === track.syntheticRef;
				if (!matchesRealTrack && !matchesLegacyBranch) continue;
				updateCardInStore(store, card.id, {
					trackId: null,
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
			invalidateProjectState(project.path, { rootPath: store.rootPath });
		}

		invalidateProjectState(project.path, {
			rootPath: selectedSnapshot?.storageRoot ?? null,
		});
		return { ok: true };
	}

	function readTrackFile(trackId: string, fileName: string): TrackFileReadResult {
		const project = requireActiveProject();
		const track = getTrack(trackId);
		const realTrack = track.synthetic && track.syntheticRef
			? materializeBranchTrack(track.syntheticRef, track.title)
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
		const realTrackId = track.synthetic && track.syntheticRef
			? materializeBranchTrack(track.syntheticRef, track.title).id
			: track.id;
		const origin = findTrackOrigin(realTrackId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const file = writeTrackFileInStore(store, { ...input, trackId: realTrackId });
		invalidateProjectState(project.path, { rootPath: store.rootPath });
		return file;
	}

	function deleteTrackFile(trackId: string, fileName: string): { ok: true } {
		const project = requireActiveProject();
		const track = getTrack(trackId);
		const realTrackId = track.synthetic && track.syntheticRef
			? materializeBranchTrack(track.syntheticRef, track.title).id
			: track.id;
		const origin = findTrackOrigin(realTrackId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const result = deleteTrackFileInStore(store, realTrackId, fileName);
		invalidateProjectState(project.path, { rootPath: store.rootPath });
		return result;
	}

	function chooseProjectPath(projectPath: string): ProjectSnapshot {
		const canonicalPath = canonicalProjectPath(projectPath);
		const current = registry.readRegistry();
		const existing = current.projects.find((project) => project.path === canonicalPath);
		if (existing) {
			current.activeProjectPath = existing.path;
			current.selectedWorktreeId = canonicalPath;
			registry.writeRegistry(current);
			invalidateAllCaches();
			return stripInternalSnapshotFields(aggregateSnapshot(existing, true).snapshotBase)!;
		}

		const project: Project = {
			name: projectName(canonicalPath),
			path: canonicalPath,
			storagePath: undefined,
		};
		project.storagePath = resolveProjectStorage(project, current, true)?.storagePath;
		current.projects.push(project);
		current.activeProjectPath = project.path;
		current.selectedWorktreeId = canonicalPath;
		registry.writeRegistry(current);
		invalidateAllCaches();
		return stripInternalSnapshotFields(aggregateSnapshot(project, true).snapshotBase)!;
	}

	function locateProjectPath(currentProjectPath: string, projectPath: string): ProjectSnapshot {
		const canonicalPath = canonicalProjectPath(projectPath);
		const current = registry.readRegistry();
		const project = current.projects.find((entry) => entry.path === currentProjectPath);
		if (!project) throw new Error(`Unknown project: ${currentProjectPath}`);
		project.path = canonicalPath;
		project.name = projectName(canonicalPath);
		project.storagePath = resolveProjectStorage(project, current, true)?.storagePath;
		current.activeProjectPath = project.path;
		current.selectedWorktreeId = canonicalPath;
		registry.writeRegistry(current);
		invalidateAllCaches();
		return stripInternalSnapshotFields(aggregateSnapshot(project, true).snapshotBase)!;
	}

	function removeProject(projectPath: string): ProjectSnapshot | null {
		const current = registry.readRegistry();
		const previousLength = current.projects.length;
		current.projects = current.projects.filter((project) => project.path !== projectPath);
		if (current.projects.length === previousLength) throw new Error(`Unknown project: ${projectPath}`);
		if (current.activeProjectPath === projectPath) {
			current.activeProjectPath = current.projects[0]?.path ?? null;
			current.selectedWorktreeId = current.projects[0]?.path ?? null;
		}
		registry.writeRegistry(current);
		invalidateAllCaches();
		return activeSnapshot();
	}

	function switchProject(projectPath: string): DesktopState {
		const current = registry.readRegistry();
		const project = resolveVisibleProject(projectPath);
		if (!project) throw new Error(`Unknown project: ${projectPath}`);
		current.activeProjectPath = projectPath;
		current.selectedWorktreeId = project.path;
		registry.writeRegistry(current);
		projectViewCache = null;
		return toDesktopState(getCachedDesktopState(true));
	}

	function createBoard(input: CreateBoardInput): ProjectSnapshot {
		const store = openTargetStore(true);
		const currentSnapshot = activeSnapshotWithInternals();
		const name = input.name.trim();
		if (!name) throw new Error("Board name is required");

		const existingIds = new Set(currentSnapshot?.boards.map((board) => board.id) ?? []);
		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		let boardId = slug || newId("board").slice(-8).toLowerCase();
		while (existingIds.has(boardId)) {
			boardId = `${slug || "item"}-${newId("board").slice(-6).toLowerCase()}`;
		}

		writeJsonAtomic(boardPath(store.rootPath, boardId), {
			id: boardId,
			version: 1,
			name,
			columns: defaultColumns(),
			customFields: [],
		});

		const current = registry.readRegistry();
		current.selectedBoardId = boardId;
		registry.writeRegistry(current);
		invalidateProjectState(store.project.path, { rootPath: store.rootPath });
		return stripInternalSnapshotFields(activeSnapshotWithInternals())!;
	}

	function deleteBoard(boardId: string): ProjectSnapshot {
		const currentSnapshot = activeSnapshotWithInternals();
		const descriptors = currentSnapshot?.boards ?? [];
		if (!descriptors.some((board) => board.id === boardId)) throw new Error(`Unknown board: ${boardId}`);
		if (descriptors.length <= 1) throw new Error("Trackboi needs at least one board");
		if (currentSnapshot?.cards.some((card) => card.boardId === boardId)) {
			throw new Error("Move or delete board cards before removing this board");
		}
		const store = openTargetStore(false);
		rmSync(boardPath(store.rootPath, boardId), { force: true });

		const current = registry.readRegistry();
		if (current.selectedBoardId === boardId) {
			current.selectedBoardId = descriptors.find((board) => board.id !== boardId)?.id ?? null;
			registry.writeRegistry(current);
		}
		invalidateProjectState(store.project.path, { rootPath: store.rootPath });
		return stripInternalSnapshotFields(activeSnapshotWithInternals())!;
	}

	function setStorageSearchPaths(paths: string[]): ProjectView {
		const current = registry.readRegistry();
		current.storageSearchPaths = normalizeStorageSearchPaths(paths);
		registry.writeRegistry(current);
		invalidateAllCaches();
		return listView();
	}

	function setActiveWorkspaceFile(filePath: string | null): ProjectView {
		const current = registry.readRegistry();
		current.activeWorkspaceFile = filePath || null;
		registry.writeRegistry(current);
		projectViewCache = null;
		return listView();
	}

	function updateProjectPeople(people: PersonAlias[]): ProjectMetadata {
		const store = openTargetStore(true);
		const filePath = projectMetadataPath(store.rootPath);
		const metadata = normalizeProjectMetadata(readJson<ProjectMetadata>(filePath), store.project, store.storagePath);
		const nextMetadata = { ...metadata, people };
		writeJsonAtomic(filePath, nextMetadata);
		invalidateProjectState(store.project.path, { rootPath: store.rootPath });
		return nextMetadata;
	}

	function createCard(input: CreateCardInput): Card {
		const project = requireActiveProject();
		const worktree = requireSelectedWorktree();
		const snapshot = readSnapshotForPath(project, worktree.path, true);
		if (!snapshot) throw new Error("Choose a project first");
		const trackId = ensureTrackIdForCardInput(input, input.title);
		const store = openTargetStore(true);
		const actorId = resolveDesktopActorId(store, worktree.path, input.actorId);
		const card = createCardInStore(store, snapshot, {
			...input,
			boardId: input.boardId ?? requireActiveBoard().id,
			trackId,
			actorId,
		});
		invalidateProjectState(project.path, {
			rootPath: store.rootPath,
			worktrees: true,
			view: true,
		});
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
		const snapshot = readSnapshotForPath(project, origin.worktreePath, false);
		if (!snapshot) throw new Error(`Unknown card origin for ${cardId}`);
		const currentCard = snapshot.cards.find((candidate) => candidate.id === cardId);
		if (!currentCard) throw new Error(`Unknown card: ${cardId}`);
		const targetBoardId = patch.boardId ?? currentCard.boardId;
		const targetColumnId = patch.column ?? currentCard.column;
		requireBoardColumn(snapshot, targetBoardId, targetColumnId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const storedCard = readCards(store.rootPath).find((candidate) => candidate.id === cardId);
		if (!storedCard) throw new Error(`Unknown card: ${cardId}`);
		const trackId = ensureTrackIdForCardInput({
			trackId: patch.trackId ?? storedCard.trackId ?? null,
			legacyScope: storedCard.scope,
		}, storedCard.scope.kind === "track" ? storedCard.scope.ref : storedCard.title);
		const actorId = resolveDesktopActorId(store, origin.worktreePath, (patch as CardPatch & { actorId?: string }).actorId);
		const card = updateCardInStore(store, cardId, {
			...toStoredCardPatch(patch, trackId),
			actorId,
		} as CardPatch);
		invalidateProjectState(project.path, { rootPath: store.rootPath });
		return card;
	}

	function addCardComment(input: CreateCardCommentInput): CardComment {
		const project = requireActiveProject();
		const origin = findCardOrigin(input.cardId);
		const store = openStore({
			...project,
			path: origin.worktreePath,
			storagePath: undefined,
		}, registry.readRegistry(), false);
		const card = readCards(store.rootPath).find((candidate) => candidate.id === input.cardId);
		if (!card) throw new Error(`Unknown card: ${input.cardId}`);
		const actorId = resolveDesktopActorId(store, origin.worktreePath, input.actorId);
		const comment = addCardCommentInStore(store, card, {
			...input,
			actorId,
		});
		invalidateProjectState(project.path, { rootPath: store.rootPath });
		return comment;
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
		invalidateProjectState(project.path, { rootPath: store.rootPath });
		return card;
	}

	function updateBoard(board: Board): Board {
		const store = openTargetStore(true);
		writeJsonAtomic(boardPath(store.rootPath, board.id), board);
		invalidateProjectState(store.project.path, { rootPath: store.rootPath });
		return board;
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
		invalidateProjectState(project.path, {
			rootPath: store.rootPath,
			worktrees: true,
			view: true,
		});
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
		prewarmProjects,
		invalidateCache,
		invalidateStorageRoot,
		setSelectedWorktree,
		listBoards,
		setActiveBoard,
		readAppSettings,
		updateAppSettings,
		listGitChanges,
		commitGitChanges,
		updateProjectSettings,
		updateProjectPeople,
		chooseProjectPath,
		locateProjectPath,
		removeProject,
		switchProject,
		setStorageSearchPaths,
		setActiveWorkspaceFile,
		createBoard,
		deleteBoard,
		listTracks,
		getTrack,
		createTrack,
		updateTrack,
		deleteTrack,
		readTrackFile,
		writeTrackFile,
		deleteTrackFile,
		createCard,
		addCardComment,
		updateCard,
		updateBoard,
		moveCard,
		deleteCard,
	};
}

export { stripInternalSnapshotFields } from "./services/runtimeAggregation";
