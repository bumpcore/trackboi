import { computed, ref, type ComputedRef, type Ref } from "vue";
import { rankBetween } from "@/core/rank";
import type {
	Board,
	BoardDescriptor,
	Card,
	CardComment,
	DesktopState,
	GitContext,
	Project,
	ProjectEntry,
	ProjectMetadata,
	ProjectSnapshot,
	ProjectView,
	Track,
	WorktreeContext,
} from "@/core/types";
import { desktop } from "@/electron/renderer";
import type { DesktopStorePatch } from "@/electron/bridge";
import type { Confirmation, SettingsSection } from "@/ui/viewTypes";

type ConfirmationRequester = (confirmation: Confirmation) => void;
type WorktreeMemory = Record<string, string | null>;

const WORKTREE_MEMORY_KEY = "trackboi:worktree-memory:v1";

type RunOptions = {
	globalBusy?: boolean;
	rethrow?: boolean;
};

type DesktopProjectState = {
	snapshot: Readonly<Ref<ProjectSnapshot | null>>;
	view: Ref<ProjectView>;
	worktrees: Ref<WorktreeContext[]>;
	selectedWorktreeId: Ref<string | null>;
	selectedBoardId: Ref<string | null>;
	loading: Ref<boolean>;
	busy: Readonly<Ref<boolean>>;
	error: Ref<string | null>;
	settingsOpen: Ref<boolean>;
	settingsSection: Ref<SettingsSection>;
	storagePathDraft: Ref<string>;
	run(action: () => Promise<void>, options?: RunOptions): Promise<void>;
	setError(errorValue: unknown): void;
	loadProject(): Promise<void>;
	refreshDesktopState(): Promise<void>;
	applyDesktopState(nextState: DesktopState): void;
	applyDesktopStorePatch(patch: DesktopStorePatch): void;
	replaceSnapshot(nextSnapshot: ProjectSnapshot | null): void;
	replaceBoard(board: Board): void;
	replaceMetadata(metadata: ProjectMetadata): void;
	upsertTrack(track: Track): void;
	removeTrack(trackId: string): void;
	updateTrackFile(trackId: string, file: Track["files"][number]): void;
	removeTrackFile(trackId: string, fileName: string): void;
	upsertCard(card: Card): void;
	removeCard(cardId: string): void;
	addCardComment(comment: CardComment): void;
	optimisticMoveCard(cardId: string, toColumn: string, beforeCardId: string | null): () => void;
	chooseProject(): Promise<void>;
	locateProject(projectPath: string): Promise<void>;
	removeProject(projectPath: string): Promise<void>;
	addStorageSearchPath(): Promise<void>;
	removeStorageSearchPath(path: string): Promise<void>;
	resetStorageSearchPaths(): Promise<void>;
	switchProject(projectPath: string): Promise<void>;
	selectWorktree(worktreeId: string): Promise<void>;
	selectBoard(boardId: string): Promise<void>;
	openSettings(section?: SettingsSection): void;
	closeSettings(): void;
	openProjectSettings(): void;
	allEntries: ComputedRef<ProjectEntry[]>;
	activeProject: ComputedRef<ProjectEntry | null>;
	canRemoveActiveProject: ComputedRef<boolean>;
	hasProjects: ComputedRef<boolean>;
	selectedWorktree: ComputedRef<WorktreeContext | null>;
	gitBranchLabel: ComputedRef<string | null>;
	currentBranch: ComputedRef<string | null>;
};

type InternalDesktopProjectState = DesktopProjectState & {
	ensurePatchSubscription(): void;
};

let singleton: InternalDesktopProjectState | null = null;
let confirmationRequester: ConfirmationRequester = () => undefined;

function readWorktreeMemory(): WorktreeMemory {
	if (typeof window === "undefined") return {};

	try {
		const raw = window.localStorage.getItem(WORKTREE_MEMORY_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") return {};

		return Object.fromEntries(
			Object.entries(parsed).filter((entry): entry is [string, string | null] => (
				typeof entry[0] === "string"
				&& (typeof entry[1] === "string" || entry[1] == null)
			)),
		);
	} catch {
		return {};
	}
}

function writeWorktreeMemory(memory: WorktreeMemory) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(WORKTREE_MEMORY_KEY, JSON.stringify(memory));
}

function cloneBoard(board: Board): Board {
	return {
		...board,
		columns: board.columns.map((column) => ({ ...column })),
		customFields: board.customFields.map((field) => (
			field.options ? { ...field, options: [...field.options] } : { ...field }
		)),
	};
}

function cloneBoardDescriptors(boards: BoardDescriptor[]): BoardDescriptor[] {
	return boards.map((board) => ({ ...board, worktreeIds: [...board.worktreeIds] }));
}

function cloneMetadata(metadata: ProjectMetadata): ProjectMetadata {
	return {
		...metadata,
		people: metadata.people.map((person) => ({
			...person,
			gitEmails: [...person.gitEmails],
			gitNames: [...person.gitNames],
		})),
		agents: metadata.agents.map((agent) => ({ ...agent })),
	};
}

function cloneTrack(track: Track): Track {
	return {
		...track,
		decisions: track.decisions.map((decision) => ({ ...decision })),
		references: track.references.map((reference) => ({ ...reference })),
		files: track.files.map((file) => ({ ...file })),
	};
}

function cloneCard(card: Card): Card {
	return {
		...card,
		scope: { ...card.scope },
		labels: [...card.labels],
		fieldValues: { ...card.fieldValues },
		comments: card.comments.map((comment) => ({ ...comment })),
		worktreeIds: card.worktreeIds ? [...card.worktreeIds] : undefined,
		variants: card.variants?.map((variant) => ({
			...variant,
			scope: { ...variant.scope },
		})),
	};
}

/**
 * Owns desktop-level project state and the shell-facing actions that reshape it.
 *
 * The public API still exposes a snapshot-shaped view for compatibility, but
 * the store now keeps cards and tracks in indexed entity maps so hot-path
 * updates stop cloning the full snapshot tree.
 */
function createDesktopProjectState(): InternalDesktopProjectState {
	const projectState = ref<Project | null>(null);
	const metadataState = ref<ProjectMetadata | null>(null);
	const gitState = ref<GitContext | null>(null);
	const boardState = ref<Board | null>(null);
	const boardsState = ref<BoardDescriptor[]>([]);
	const trackIds = ref<string[]>([]);
	const tracksById = ref<Record<string, Track>>({});
	const cardIds = ref<string[]>([]);
	const cardsById = ref<Record<string, Card>>({});

	const view = ref<ProjectView>({ sources: [], activeProjectPath: null, storageSearchPaths: [] });
	const worktrees = ref<WorktreeContext[]>([]);
	const selectedWorktreeId = ref<string | null>(null);
	const selectedBoardId = ref<string | null>(null);
	const loading = ref(true);
	const globalPendingCount = ref(0);
	const error = ref<string | null>(null);
	const settingsOpen = ref(false);
	const settingsSection = ref<SettingsSection>("storage");
	const storagePathDraft = ref("");
	const busy = computed(() => globalPendingCount.value > 0);
	let patchListenerStarted = false;

	const snapshot = computed<ProjectSnapshot | null>(() => {
		if (!projectState.value || !metadataState.value || !gitState.value || !boardState.value) return null;

		return {
			project: { ...projectState.value },
			metadata: cloneMetadata(metadataState.value),
			git: { ...gitState.value },
			board: cloneBoard(boardState.value),
			boards: cloneBoardDescriptors(boardsState.value),
			tracks: trackIds.value
				.map((trackId) => tracksById.value[trackId])
				.filter((track): track is Track => track != null)
				.map(cloneTrack),
			cards: cardIds.value
				.map((cardId) => cardsById.value[cardId])
				.filter((card): card is Card => card != null)
				.map(cloneCard),
		};
	});

	const allEntries = computed<ProjectEntry[]>(() => (
		view.value.sources.flatMap((source) => source.entries)
	));
	const activeProject = computed<ProjectEntry | null>(() => {
		const projectPath = view.value.activeProjectPath;
		if (!projectPath) return null;
		return allEntries.value.find((entry) => entry.projectPath === projectPath) ?? null;
	});
	const canRemoveActiveProject = computed(() => {
		const projectPath = view.value.activeProjectPath;
		if (!projectPath) return false;
		return view.value.sources
			.find((source) => source.kind === "manual")
			?.entries.some((entry) => entry.projectPath === projectPath) ?? false;
	});
	const hasProjects = computed(() => allEntries.value.length > 0);
	const selectedWorktree = computed(() => (
		worktrees.value.find((worktree) => worktree.id === selectedWorktreeId.value) ?? null
	));
	const gitBranchLabel = computed(() => {
		if (!gitState.value?.isGitRepo) return null;
		return gitState.value.branch ?? (gitState.value.detached ? "detached" : "git");
	});
	const currentBranch = computed(() => gitState.value?.branch ?? null);

	function setError(errorValue: unknown) {
		error.value = errorValue instanceof Error ? errorValue.message : String(errorValue);
	}

	function rememberProjectWorktree(projectPath: string | null, worktreeId: string | null) {
		if (!projectPath) return;
		const memory = readWorktreeMemory();
		memory[projectPath] = worktreeId;
		writeWorktreeMemory(memory);
	}

	function resetSnapshotState() {
		projectState.value = null;
		metadataState.value = null;
		gitState.value = null;
		boardState.value = null;
		boardsState.value = [];
		trackIds.value = [];
		tracksById.value = {};
		cardIds.value = [];
		cardsById.value = {};
	}

	function assignSnapshot(nextSnapshot: ProjectSnapshot | null) {
		if (!nextSnapshot) {
			resetSnapshotState();
			return;
		}

		projectState.value = { ...nextSnapshot.project };
		metadataState.value = cloneMetadata(nextSnapshot.metadata);
		gitState.value = { ...nextSnapshot.git };
		boardState.value = cloneBoard(nextSnapshot.board);
		boardsState.value = cloneBoardDescriptors(nextSnapshot.boards);
		trackIds.value = nextSnapshot.tracks.map((track) => track.id);
		tracksById.value = Object.fromEntries(nextSnapshot.tracks.map((track) => [track.id, cloneTrack(track)]));
		cardIds.value = nextSnapshot.cards.map((card) => card.id);
		cardsById.value = Object.fromEntries(nextSnapshot.cards.map((card) => [card.id, cloneCard(card)]));
	}

	function currentBoardId(): string | null {
		return boardState.value?.id ?? null;
	}

	function replaceTrackEntity(trackId: string, updater: (track: Track) => Track | null) {
		const current = tracksById.value[trackId];
		if (!current) return;
		const nextTrack = updater(current);
		if (!nextTrack) return;
		tracksById.value = {
			...tracksById.value,
			[trackId]: nextTrack,
		};
	}

	function replaceCardEntity(cardId: string, updater: (card: Card) => Card | null) {
		const current = cardsById.value[cardId];
		if (!current) return;
		const nextCard = updater(current);
		if (!nextCard) return;
		cardsById.value = {
			...cardsById.value,
			[cardId]: nextCard,
		};
	}

	async function restoreRememberedWorktree(nextState: DesktopState): Promise<DesktopState> {
		const projectPath = nextState.view.activeProjectPath;
		if (!projectPath) return nextState;

		const rememberedWorktreeId = readWorktreeMemory()[projectPath] ?? null;
		if (!rememberedWorktreeId) return nextState;

		if (!nextState.worktrees.some((worktree) => worktree.id === rememberedWorktreeId)) {
			rememberProjectWorktree(projectPath, null);
			return nextState;
		}

		if (nextState.selectedWorktreeId === rememberedWorktreeId) return nextState;

		return desktop.setSelectedWorktree(rememberedWorktreeId);
	}

	function applyDesktopState(nextState: DesktopState) {
		view.value = nextState.view;
		worktrees.value = nextState.worktrees;
		selectedWorktreeId.value = nextState.selectedWorktreeId;
		selectedBoardId.value = nextState.selectedBoardId;
		assignSnapshot(nextState.snapshot);
	}

	function replaceSnapshot(nextSnapshot: ProjectSnapshot | null) {
		assignSnapshot(nextSnapshot);
		selectedBoardId.value = nextSnapshot?.board.id ?? null;
	}

	function replaceBoard(board: Board) {
		if (!boardState.value) return;
		if (boardState.value.id === board.id) boardState.value = cloneBoard(board);
		boardsState.value = boardsState.value.map((entry) => (
			entry.id === board.id ? { ...entry, name: board.name } : entry
		));
	}

	function replaceMetadata(metadata: ProjectMetadata) {
		if (!metadataState.value) return;
		metadataState.value = cloneMetadata(metadata);
	}

	function upsertTrack(track: Track) {
		tracksById.value = {
			...tracksById.value,
			[track.id]: cloneTrack(track),
		};
		if (!trackIds.value.includes(track.id)) {
			trackIds.value = [...trackIds.value, track.id];
		}
	}

	function removeTrack(trackId: string) {
		if (!tracksById.value[trackId]) return;

		const nextTracks = { ...tracksById.value };
		delete nextTracks[trackId];
		tracksById.value = nextTracks;
		trackIds.value = trackIds.value.filter((id) => id !== trackId);

		let mutatedCards = false;
		const nextCards = { ...cardsById.value };
		for (const [cardId, card] of Object.entries(nextCards)) {
			if (card.trackId !== trackId) continue;
			nextCards[cardId] = {
				...card,
				trackId: null,
				scope: { kind: "project", ref: "global" },
			};
			mutatedCards = true;
		}
		if (mutatedCards) cardsById.value = nextCards;
	}

	function updateTrackFile(trackId: string, file: Track["files"][number]) {
		replaceTrackEntity(trackId, (track) => {
			const files = [...track.files];
			const nextFile = { ...file };
			const index = files.findIndex((entry) => entry.name === file.name);
			if (index === -1) files.push(nextFile);
			else files.splice(index, 1, nextFile);
			return {
				...track,
				files,
			};
		});
	}

	function removeTrackFile(trackId: string, fileName: string) {
		replaceTrackEntity(trackId, (track) => ({
			...track,
			files: track.files.filter((file) => file.name !== fileName),
		}));
	}

	function upsertCard(card: Card) {
		if (!currentBoardId() || card.boardId !== currentBoardId()) return;
		cardsById.value = {
			...cardsById.value,
			[card.id]: cloneCard(card),
		};
		if (!cardIds.value.includes(card.id)) {
			cardIds.value = [...cardIds.value, card.id];
		}
	}

	function removeCard(cardId: string) {
		if (!cardsById.value[cardId]) return;
		const deletedIds = new Set(
			cardIds.value.filter((candidateId) => (
				candidateId === cardId || cardsById.value[candidateId]?.parentId === cardId
			)),
		);
		const nextCards = { ...cardsById.value };
		for (const deletedId of deletedIds) delete nextCards[deletedId];
		cardsById.value = nextCards;
		cardIds.value = cardIds.value.filter((candidateId) => !deletedIds.has(candidateId));
	}

	function addCardComment(comment: CardComment) {
		replaceCardEntity(comment.cardId, (card) => ({
			...card,
			comments: [...card.comments, { ...comment }],
			updatedAt: comment.updatedAt,
			updatedBy: comment.updatedBy,
		}));
	}

	function optimisticMoveCard(cardId: string, toColumn: string, beforeCardId: string | null): () => void {
		const card = cardsById.value[cardId];
		if (!card) return () => undefined;

		const previousColumn = card.column;
		const previousRank = card.rank;
		const previousUpdatedAt = card.updatedAt;
		const targetCards = cardIds.value
			.map((candidateId) => cardsById.value[candidateId])
			.filter((candidate): candidate is Card => (
				candidate != null
				&& candidate.id !== cardId
				&& candidate.parentId == null
				&& candidate.column === toColumn
			))
			.sort((left, right) => left.rank.localeCompare(right.rank));
		const beforeIndex = beforeCardId
			? targetCards.findIndex((candidate) => candidate.id === beforeCardId)
			: -1;
		const previousRankNeighbor = beforeIndex > 0
			? targetCards[beforeIndex - 1]?.rank ?? null
			: beforeIndex === 0
				? null
				: targetCards.at(-1)?.rank ?? null;
		const nextRankNeighbor = beforeIndex >= 0 ? targetCards[beforeIndex]?.rank ?? null : null;

		replaceCardEntity(cardId, (currentCard) => ({
			...currentCard,
			column: toColumn,
			rank: rankBetween(previousRankNeighbor, nextRankNeighbor),
			updatedAt: new Date().toISOString(),
		}));

		return () => {
			replaceCardEntity(cardId, (currentCard) => ({
				...currentCard,
				column: previousColumn,
				rank: previousRank,
				updatedAt: previousUpdatedAt,
			}));
		};
	}

	function applyDesktopStorePatch(patch: DesktopStorePatch) {
		if (patch.type === "contextReplaced") {
			applyDesktopState(patch.state);
			return;
		}
		if (patch.type === "viewUpdated") {
			view.value = patch.view;
			return;
		}
		if (patch.type === "selectionUpdated") {
			if (patch.activeProjectPath !== undefined) {
				view.value = { ...view.value, activeProjectPath: patch.activeProjectPath };
			}
			if (patch.selectedWorktreeId !== undefined) selectedWorktreeId.value = patch.selectedWorktreeId;
			if (patch.selectedBoardId !== undefined) selectedBoardId.value = patch.selectedBoardId;
			return;
		}
		if (patch.type === "worktreesReplaced") {
			if (patch.projectPath === view.value.activeProjectPath) worktrees.value = patch.worktrees;
			return;
		}
		if (patch.type === "boardUpserted") {
			replaceBoard(patch.board);
			if (patch.boards) boardsState.value = cloneBoardDescriptors(patch.boards);
			if (patch.selectedBoardId !== undefined) selectedBoardId.value = patch.selectedBoardId;
			return;
		}
		if (patch.type === "boardRemoved") {
			boardsState.value = patch.boards
				? cloneBoardDescriptors(patch.boards)
				: boardsState.value.filter((board) => board.id !== patch.boardId);
			if (patch.selectedBoardId !== undefined) selectedBoardId.value = patch.selectedBoardId;
			return;
		}
		if (patch.type === "trackUpserted") {
			upsertTrack(patch.track);
			return;
		}
		if (patch.type === "trackRemoved") {
			removeTrack(patch.trackId);
			return;
		}
		if (patch.type === "cardUpserted") {
			upsertCard(patch.card);
			return;
		}
		if (patch.type === "cardRemoved") {
			removeCard(patch.cardId);
			return;
		}
		if (patch.type === "cardMoved") {
			replaceCardEntity(patch.cardId, (card) => ({
				...card,
				column: patch.toColumn,
				rank: patch.rank,
			}));
			return;
		}
		if (patch.type === "metadataUpdated") {
			replaceMetadata(patch.metadata);
			return;
		}
		if (patch.type === "storagePathsUpdated") {
			view.value = {
				...view.value,
				storageSearchPaths: [...patch.storageSearchPaths],
			};
		}
	}

	async function refreshDesktopState() {
		applyDesktopState(await restoreRememberedWorktree(await desktop.readDesktopState()));
	}

	async function run(action: () => Promise<void>, options: RunOptions = {}) {
		error.value = null;
		const shouldAffectBusy = options.globalBusy !== false;
		if (shouldAffectBusy) globalPendingCount.value += 1;
		try {
			await action();
		} catch (caught) {
			setError(caught);
			if (options.rethrow) throw caught;
		} finally {
			if (shouldAffectBusy) globalPendingCount.value = Math.max(0, globalPendingCount.value - 1);
		}
	}

	function ensurePatchSubscription() {
		if (patchListenerStarted) return;
		patchListenerStarted = true;
		desktop.addDesktopStorePatchListener((patch) => {
			applyDesktopStorePatch(patch);
		});
	}

	async function loadProject() {
		ensurePatchSubscription();
		loading.value = true;
		error.value = null;
		try {
			await refreshDesktopState();
		} catch (caught) {
			setError(caught);
		} finally {
			loading.value = false;
		}
	}

	async function chooseProject() {
		await run(async () => {
			await desktop.chooseProject();
			await refreshDesktopState();
		});
	}

	async function locateProject(projectPath: string) {
		await run(async () => {
			await desktop.locateProject(projectPath);
			await refreshDesktopState();
		});
	}

	async function removeProject(projectPath: string) {
		const entry = allEntries.value.find((candidate) => candidate.projectPath === projectPath);
		if (!entry) return;

		confirmationRequester({
			title: `Remove ${entry.name}?`,
			description: "Trackboi will forget this project, but files on disk will stay where they are.",
			confirmLabel: "Remove",
			destructive: true,
			onConfirm: async () => {
				await run(async () => {
					await desktop.removeProject(projectPath);
					await refreshDesktopState();
				});
			},
		});
	}

	async function addStorageSearchPath() {
		const path = storagePathDraft.value.trim();
		if (!path) return;

		await run(async () => {
			view.value = await desktop.setStorageSearchPaths([...view.value.storageSearchPaths, path]);
			storagePathDraft.value = "";
		});
	}

	async function removeStorageSearchPath(path: string) {
		if (view.value.storageSearchPaths.length <= 1) {
			setError("Trackboi needs at least one storage search path");
			return;
		}

		await run(async () => {
			view.value = await desktop.setStorageSearchPaths(
				view.value.storageSearchPaths.filter((candidate) => candidate !== path),
			);
		});
	}

	async function resetStorageSearchPaths() {
		await run(async () => {
			view.value = await desktop.setStorageSearchPaths([".trackboi", ".etc/.trackboi", ".etc/trackboi"]);
		});
	}

	async function switchProject(projectPath: string) {
		if (projectPath === view.value.activeProjectPath) return;

		await run(async () => {
			applyDesktopState(await restoreRememberedWorktree(await desktop.switchProject(projectPath)));
		});
	}

	async function selectWorktree(worktreeId: string) {
		if (worktreeId === selectedWorktreeId.value) return;

		await run(async () => {
			applyDesktopState(await desktop.setSelectedWorktree(worktreeId));
			rememberProjectWorktree(view.value.activeProjectPath, worktreeId);
		});
	}

	async function selectBoard(boardId: string) {
		if (boardId === selectedBoardId.value) return;
		await run(async () => {
			applyDesktopState(await desktop.setActiveBoard(boardId));
		});
	}

	function openSettings(section: SettingsSection = "storage") {
		settingsSection.value = section;
		settingsOpen.value = true;
	}

	function closeSettings() {
		settingsOpen.value = false;
	}

	function openProjectSettings() {
		openSettings("project");
	}

	return {
		snapshot,
		view,
		worktrees,
		selectedWorktreeId,
		selectedBoardId,
		loading,
		busy,
		error,
		settingsOpen,
		settingsSection,
		storagePathDraft,
		run,
		setError,
		loadProject,
		refreshDesktopState,
		applyDesktopState,
		applyDesktopStorePatch,
		replaceSnapshot,
		replaceBoard,
		replaceMetadata,
		upsertTrack,
		removeTrack,
		updateTrackFile,
		removeTrackFile,
		upsertCard,
		removeCard,
		addCardComment,
		optimisticMoveCard,
		chooseProject,
		locateProject,
		removeProject,
		addStorageSearchPath,
		removeStorageSearchPath,
		resetStorageSearchPaths,
		switchProject,
		selectWorktree,
		selectBoard,
		openSettings,
		closeSettings,
		openProjectSettings,
		allEntries,
		activeProject,
		canRemoveActiveProject,
		hasProjects,
		selectedWorktree,
		gitBranchLabel,
		currentBranch,
		ensurePatchSubscription,
	};
}

export function useDesktopProjectState(requestConfirmation: ConfirmationRequester): DesktopProjectState {
	confirmationRequester = requestConfirmation;
	singleton ??= createDesktopProjectState();
	return singleton;
}

/**
 * Resets the singleton desktop project state between isolated test runs.
 */
export function resetDesktopProjectStateForTests(): void {
	singleton = null;
	confirmationRequester = () => undefined;
}
