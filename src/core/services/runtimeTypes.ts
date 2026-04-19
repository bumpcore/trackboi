import type {
	Card,
	GitContext,
	Project,
	ProjectSnapshotWithInternals,
	ProjectView,
	Track,
	WorktreeContext,
} from "../types";

/**
 * Internal worktree shape used while the runtime is resolving storage roots,
 * git metadata, and selected-worktree state.
 */
export type WorktreeStore = WorktreeContext & {
	project: Project;
	git: GitContext;
};

/**
 * Cached desktop-state bundle kept inside the runtime so repeated renderer
 * reads can reuse the same aggregated snapshot.
 */
export type CachedDesktopState = {
	projectKey: string;
	snapshotBase: ProjectSnapshotWithInternals | null;
	view: ProjectView;
	worktrees: WorktreeStore[];
};

/**
 * Groups cached desktop-state bundles by project so selection changes can swap
 * between already-aggregated snapshots instead of rebuilding each project from
 * disk on every project switch.
 */
export type DesktopStateCache = Map<string, CachedDesktopState>;

/**
 * Captures one card as it appears in one worktree-backed store before runtime
 * aggregation merges variants into the board-level snapshot.
 */
export type CardOrigin = {
	card: Card;
	worktree: WorktreeStore;
	storagePath: string;
};

/**
 * Captures one track as it appears in one worktree-backed store before runtime
 * aggregation selects the winning track record.
 */
export type TrackOrigin = {
	track: Track;
	worktree: WorktreeStore;
	storagePath: string;
};
