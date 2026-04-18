import { existsSync } from "node:fs";
import { DEFAULT_BOARD_ID } from "../constants";
import { boardPath } from "../paths";
import { slugifyTrackTitle } from "../tracks";
import type {
	Card,
	CardVariant,
	Project,
	ProjectSnapshot,
	ProjectSnapshotWithInternals,
	Track,
} from "../types";
import type { CardOrigin, TrackOrigin, WorktreeStore } from "./runtimeTypes";

/**
 * Aggregates worktree-backed stores into the single project snapshot consumed
 * by the desktop shell, CLI, and MCP surfaces.
 */
export function aggregateSnapshot(options: {
	project: Project;
	create: boolean;
	discoverWorktrees(project: Project): WorktreeStore[];
	pickSelectedWorktree(worktrees: WorktreeStore[]): WorktreeStore | null;
	createSelectedWorktreeStore(project: Project, worktree: WorktreeStore): WorktreeStore;
	readSnapshotForPath(project: Project, projectPath: string, create: boolean): ProjectSnapshotWithInternals | null;
}): { snapshotBase: ProjectSnapshotWithInternals | null; worktrees: WorktreeStore[] } {
	const { project, create, discoverWorktrees, pickSelectedWorktree, createSelectedWorktreeStore, readSnapshotForPath } = options;
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
	const tracksById = new Map<string, TrackOrigin[]>();
	for (const entry of storeSnapshots) {
		for (const track of entry.snapshot.tracks) {
			const storagePath = entry.worktree.storagePath ?? ".trackboi";
			const origins = tracksById.get(track.id) ?? [];
			origins.push({ track, worktree: entry.worktree, storagePath });
			tracksById.set(track.id, origins);
		}
		for (const card of entry.snapshot.cards) {
			const storagePath = entry.worktree.storagePath ?? ".trackboi";
			const origins = cardsById.get(card.id) ?? [];
			origins.push({ card, worktree: entry.worktree, storagePath });
			cardsById.set(card.id, origins);
		}
	}

	const realTracks = [...tracksById.values()]
		.map((origins) => mergeTrackOrigins(origins))
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));
	const branchTracksByRef = new Map(
		realTracks.flatMap((track) => track.source.kind === "branch" ? [[track.source.ref, track] as const] : []),
	);
	const syntheticTracksByRef = new Map<string, Track>();
	const aggregatedCards = [...cardsById.values()]
		.map((origins) => mergeCardVariants(origins, branchTracksByRef, syntheticTracksByRef))
		.sort((left, right) => left.column.localeCompare(right.column) || left.rank.localeCompare(right.rank));
	const tracks = [
		...realTracks,
		...[...syntheticTracksByRef.values()].filter((track) => (
			track.source.kind !== "branch" || !branchTracksByRef.has(track.source.ref)
		)),
	].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));

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
			tracks,
			cards: aggregatedCards,
			storageRoot: primary.storageRoot ?? primarySnapshot.storageRoot,
		},
		worktrees,
	};
}

/**
 * Removes runtime-only fields before snapshots cross the core/client boundary.
 */
export function stripInternalSnapshotFields(snapshot: ProjectSnapshotWithInternals | null): ProjectSnapshot | null {
	if (!snapshot) return snapshot;
	const { storageRoot: _storageRoot, ...publicSnapshot } = snapshot;
	return publicSnapshot;
}

/**
 * Rebinds the aggregated snapshot to the currently selected worktree so git and
 * storage cues in the desktop shell reflect the user's active context.
 */
export function withSelectedWorktree(
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

function syntheticTrackId(ref: string): string {
	return `synthetic-track:${ref}`;
}

function createSyntheticTrack(ref: string): Track {
	const timestamp = new Date().toISOString();
	return {
		id: syntheticTrackId(ref),
		boardId: DEFAULT_BOARD_ID,
		title: ref,
		slug: slugifyTrackTitle(ref),
		source: { kind: "branch", ref },
		summary: "",
		plan: "",
		decisions: [],
		references: [],
		activity: [],
		files: [],
		createdAt: timestamp,
		updatedAt: timestamp,
		synthetic: true,
	};
}

function mergeTrackOrigins(origins: TrackOrigin[]): Track {
	const winner = [...origins].sort((left, right) => (
		right.track.updatedAt.localeCompare(left.track.updatedAt) || left.track.title.localeCompare(right.track.title)
	))[0]!;

	return {
		...winner.track,
		files: winner.track.files,
		originWorktreeId: winner.worktree.id,
		originStoragePath: winner.storagePath,
	};
}

function effectiveTrackIdForCard(
	card: Card,
	branchTracksByRef: Map<string, Track>,
	syntheticTracksByRef: Map<string, Track>,
): string | null {
	if (card.trackId) return card.trackId;
	if (card.scope.kind !== "track") return null;

	const existingTrack = branchTracksByRef.get(card.scope.ref);
	if (existingTrack) return existingTrack.id;

	const synthetic = syntheticTracksByRef.get(card.scope.ref) ?? createSyntheticTrack(card.scope.ref);
	syntheticTracksByRef.set(card.scope.ref, synthetic);
	return synthetic.id;
}

function mergeCardVariants(
	origins: CardOrigin[],
	branchTracksByRef: Map<string, Track>,
	syntheticTracksByRef: Map<string, Track>,
): Card {
	const sortedOrigins = [...origins].sort((left, right) => {
		const updated = right.card.updatedAt.localeCompare(left.card.updatedAt);
		if (updated !== 0) return updated;
		return left.worktree.name.localeCompare(right.worktree.name);
	});
	const winner = sortedOrigins[0]!;
	const effectiveTrackId = effectiveTrackIdForCard(winner.card, branchTracksByRef, syntheticTracksByRef);
	const variants: CardVariant[] = sortedOrigins.map(({ card, worktree, storagePath }) => ({
		worktreeId: worktree.id,
		worktreeName: worktree.name,
		storagePath,
		updatedAt: card.updatedAt,
		title: card.title,
		description: card.description,
		column: card.column,
		scope: card.scope,
		trackId: effectiveTrackIdForCard(card, branchTracksByRef, syntheticTracksByRef),
	}));
	const signatures = new Set(sortedOrigins.map(({ card }) => JSON.stringify({
		title: card.title,
		description: card.description,
		parentId: card.parentId,
		scope: card.scope.kind === "track" ? { kind: "project", ref: "global" } : card.scope,
		trackId: effectiveTrackIdForCard(card, branchTracksByRef, syntheticTracksByRef),
		column: card.column,
		rank: card.rank,
		labels: card.labels,
		assignee: card.assignee,
		fieldValues: card.fieldValues,
		comments: card.comments,
	})));

	return {
		...winner.card,
		scope: { kind: "project", ref: "global" },
		trackId: effectiveTrackId,
		originWorktreeId: winner.worktree.id,
		originStoragePath: winner.storagePath,
		worktreeIds: sortedOrigins.map(({ worktree }) => worktree.id),
		conflicted: signatures.size > 1,
		variants,
	};
}
