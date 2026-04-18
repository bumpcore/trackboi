import { computed, ref, type ComputedRef, type Ref } from "vue";
import { desktop } from "@/electron/renderer";
import type {
	DesktopState,
	ProjectEntry,
	ProjectSnapshot,
	ProjectView,
	WorktreeContext,
} from "@/core/types";
import type { Confirmation } from "@/ui/viewTypes";

type ConfirmationRequester = (confirmation: Confirmation) => void;
type WorktreeMemory = Record<string, string | null>;

const WORKTREE_MEMORY_KEY = "trackboi:worktree-memory:v1";

type DesktopProjectState = {
	snapshot: Ref<ProjectSnapshot | null>;
	view: Ref<ProjectView>;
	worktrees: Ref<WorktreeContext[]>;
	selectedWorktreeId: Ref<string | null>;
	worktreeFilterId: Ref<string | null>;
	loading: Ref<boolean>;
	busy: Ref<boolean>;
	error: Ref<string | null>;
	settingsOpen: Ref<boolean>;
	projectSettingsOpen: Ref<boolean>;
	storagePathDraft: Ref<string>;
	run(action: () => Promise<void>): Promise<void>;
	setError(errorValue: unknown): void;
	loadProject(): Promise<void>;
	refreshDesktopState(): Promise<void>;
	chooseProject(): Promise<void>;
	locateProject(projectId: string): Promise<void>;
	removeProject(projectId: string): Promise<void>;
	addStorageSearchPath(): Promise<void>;
	removeStorageSearchPath(path: string): Promise<void>;
	resetStorageSearchPaths(): Promise<void>;
	switchProject(projectId: string): Promise<void>;
	selectWorktree(worktreeId: string): Promise<void>;
	closeSettings(): void;
	closeProjectSettings(): void;
	allEntries: ComputedRef<ProjectEntry[]>;
	activeProject: ComputedRef<ProjectEntry | null>;
	canRemoveActiveProject: ComputedRef<boolean>;
	hasProjects: ComputedRef<boolean>;
	selectedWorktree: ComputedRef<WorktreeContext | null>;
	gitBranchLabel: ComputedRef<string | null>;
	currentBranch: ComputedRef<string | null>;
};

/**
 * Owns desktop-level project state and the shell-facing actions that reshape it.
 *
 * This composable is intentionally the only UI workflow layer that knows about
 * desktop project selection and storage search paths.
 */
export function useDesktopProjectState(requestConfirmation: ConfirmationRequester): DesktopProjectState {
	const snapshot = ref<ProjectSnapshot | null>(null);
	const view = ref<ProjectView>({ sources: [], activeProjectId: null, storageSearchPaths: [] });
	const worktrees = ref<WorktreeContext[]>([]);
	const selectedWorktreeId = ref<string | null>(null);
	const worktreeFilterId = ref<string | null>(null);
	const loading = ref(true);
	const busy = ref(false);
	const error = ref<string | null>(null);
	const settingsOpen = ref(false);
	const projectSettingsOpen = ref(false);
	const storagePathDraft = ref("");

	const allEntries = computed<ProjectEntry[]>(() => (
		view.value.sources.flatMap((source) => source.entries)
	));
	const activeProject = computed<ProjectEntry | null>(() => {
		const id = view.value.activeProjectId;
		if (!id) return null;
		return allEntries.value.find((entry) => entry.projectId === id) ?? null;
	});
	const canRemoveActiveProject = computed(() => {
		const id = view.value.activeProjectId;
		if (!id) return false;
		return view.value.sources
			.find((source) => source.kind === "manual")
			?.entries.some((entry) => entry.projectId === id) ?? false;
	});
	const hasProjects = computed(() => allEntries.value.length > 0);
	const selectedWorktree = computed(() => (
		worktrees.value.find((worktree) => worktree.id === selectedWorktreeId.value) ?? null
	));
	const gitBranchLabel = computed(() => {
		if (!snapshot.value?.git.isGitRepo) return null;
		return snapshot.value.git.branch ?? (snapshot.value.git.detached ? "detached" : "git");
	});
	const currentBranch = computed(() => snapshot.value?.git.branch ?? null);

	function setError(errorValue: unknown) {
		error.value = errorValue instanceof Error ? errorValue.message : String(errorValue);
	}

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

	function rememberProjectWorktree(projectId: string | null, worktreeId: string | null) {
		if (!projectId) return;

		const memory = readWorktreeMemory();
		memory[projectId] = worktreeId;
		writeWorktreeMemory(memory);
	}

	async function restoreRememberedWorktree(nextState: DesktopState): Promise<DesktopState> {
		const projectId = nextState.view.activeProjectId;
		if (!projectId) {
			worktreeFilterId.value = null;
			return nextState;
		}

		const rememberedWorktreeId = readWorktreeMemory()[projectId] ?? null;
		if (!rememberedWorktreeId) {
			worktreeFilterId.value = null;
			return nextState;
		}

		if (!nextState.worktrees.some((worktree) => worktree.id === rememberedWorktreeId)) {
			rememberProjectWorktree(projectId, null);
			worktreeFilterId.value = null;
			return nextState;
		}

		worktreeFilterId.value = rememberedWorktreeId;
		if (nextState.selectedWorktreeId === rememberedWorktreeId) return nextState;

		return desktop.setSelectedWorktree(rememberedWorktreeId);
	}

	function applyDesktopState(nextState: DesktopState) {
		view.value = nextState.view;
		worktrees.value = nextState.worktrees;
		selectedWorktreeId.value = nextState.selectedWorktreeId;
		if (worktreeFilterId.value && !nextState.worktrees.some((worktree) => worktree.id === worktreeFilterId.value)) {
			worktreeFilterId.value = null;
		}
		snapshot.value = nextState.snapshot;
	}

	async function refreshDesktopState() {
		applyDesktopState(await restoreRememberedWorktree(await desktop.readDesktopState()));
	}

	async function run(action: () => Promise<void>) {
		error.value = null;
		busy.value = true;
		try {
			await action();
		} catch (caught) {
			setError(caught);
		} finally {
			busy.value = false;
		}
	}

	async function loadProject() {
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

	async function locateProject(projectId: string) {
		await run(async () => {
			await desktop.locateProject(projectId);
			await refreshDesktopState();
		});
	}

	async function removeProject(projectId: string) {
		const entry = allEntries.value.find((candidate) => candidate.projectId === projectId);
		if (!entry) return;

		requestConfirmation({
			title: `Remove ${entry.name}?`,
			description: "Trackboi will forget this project, but files on disk will stay where they are.",
			confirmLabel: "Remove",
			destructive: true,
			onConfirm: async () => {
				await run(async () => {
					await desktop.removeProject(projectId);
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

	async function switchProject(projectId: string) {
		if (projectId === view.value.activeProjectId) return;

		await run(async () => {
			applyDesktopState(await restoreRememberedWorktree(await desktop.switchProject(projectId)));
		});
	}

	async function selectWorktree(worktreeId: string) {
		if (worktreeId === "__all__") {
			worktreeFilterId.value = null;
			rememberProjectWorktree(view.value.activeProjectId, null);
			return;
		}
		if (worktreeFilterId.value === worktreeId) {
			worktreeFilterId.value = null;
			rememberProjectWorktree(view.value.activeProjectId, null);
			return;
		}
		if (worktreeId === selectedWorktreeId.value && worktreeFilterId.value === worktreeId) return;

		await run(async () => {
			applyDesktopState(await desktop.setSelectedWorktree(worktreeId));
			worktreeFilterId.value = worktreeId;
			rememberProjectWorktree(view.value.activeProjectId, worktreeId);
		});
	}

	function closeSettings() {
		settingsOpen.value = false;
	}

	function closeProjectSettings() {
		projectSettingsOpen.value = false;
	}

	return {
		snapshot,
		view,
		worktrees,
		selectedWorktreeId,
		worktreeFilterId,
		loading,
		busy,
		error,
		settingsOpen,
		projectSettingsOpen,
		storagePathDraft,
		run,
		setError,
		loadProject,
		refreshDesktopState,
		chooseProject,
		locateProject,
		removeProject,
		addStorageSearchPath,
		removeStorageSearchPath,
		resetStorageSearchPaths,
		switchProject,
		selectWorktree,
		closeSettings,
		closeProjectSettings,
		allEntries,
		activeProject,
		canRemoveActiveProject,
		hasProjects,
		selectedWorktree,
		gitBranchLabel,
		currentBranch,
	};
}
