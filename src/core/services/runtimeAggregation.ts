import { existsSync } from "node:fs";
import { DEFAULT_BOARD_ID } from "../constants";
import type {
	BoardDescriptor,
	Card,
	Project,
	ProjectSnapshot,
	ProjectSnapshotWithInternals,
	Track,
} from "../types";
import type { WorktreeStore } from "./runtimeTypes";

/**
 * Builds the active desktop snapshot from the selected worktree only.
 *
 * Worktree switching is a full context switch in Trackboi. We still list the
 * discovered sibling worktrees for navigation, but we do not merge their
 * project/board/card state into one synthetic snapshot anymore.
 */
export function aggregateSnapshot(options: {
	project: Project;
	create: boolean;
	selectedBoardId: string | null;
	discoverWorktrees(project: Project): WorktreeStore[];
	pickSelectedWorktree(worktrees: WorktreeStore[]): WorktreeStore | null;
	createSelectedWorktreeStore(project: Project, worktree: WorktreeStore): WorktreeStore;
	readSnapshotForPath(project: Project, projectPath: string, create: boolean): ProjectSnapshotWithInternals | null;
}): { snapshotBase: ProjectSnapshotWithInternals | null; worktrees: WorktreeStore[] } {
	const { project, create, selectedBoardId, discoverWorktrees, pickSelectedWorktree, createSelectedWorktreeStore, readSnapshotForPath } = options;
	if (!existsSync(project.path)) return { snapshotBase: null, worktrees: [] };

	let worktrees = discoverWorktrees(project);
	let selected = pickSelectedWorktree(worktrees);
	if (!selected) return { snapshotBase: null, worktrees: [] };

	if (create && selected.status !== "ready") {
		selected = createSelectedWorktreeStore(project, selected);
		worktrees = worktrees.map((candidate) => candidate.id === selected?.id ? selected : candidate);
	}

	const selectedSnapshot = readSnapshotForPath(project, selected.path, create);
	if (!selectedSnapshot) return { snapshotBase: null, worktrees };

	const boardRecords = selectedSnapshot.boardRecords.map((board) => ({
		...board,
		columns: board.columns.map((column) => ({ ...column })),
		customFields: board.customFields.map((field) => (
			field.options ? { ...field, options: [...field.options] } : { ...field }
		)),
	}));
	const boardDescriptors: BoardDescriptor[] = boardRecords.map((board) => ({
		id: board.id,
		name: board.name,
		status: "ready",
		worktreeIds: [selected.id],
	}));
	const activeBoardId = pickActiveBoardId(boardDescriptors, selectedBoardId, selectedSnapshot.board.id);
	const activeBoard = boardRecords.find((board) => board.id === activeBoardId)
		?? boardRecords[0]
		?? selectedSnapshot.board;

	const realTracks = selectedSnapshot.tracks
		.filter((track) => track.boardId === activeBoardId)
		.map((track) => ({
			...track,
			originWorktreeId: selected.id,
			originStoragePath: selected.storagePath ?? undefined,
		}));
	const branchTracksByRef = new Map(
		realTracks.flatMap((track) => track.source.kind === "branch" ? [[track.source.ref, track] as const] : []),
	);
	const syntheticTracksByRef = new Map<string, Track>();
	const cards = selectedSnapshot.cards
		.filter((card) => card.boardId === activeBoardId)
		.map((card) => mapCardToSelectedWorktree(card, selected, activeBoardId, branchTracksByRef, syntheticTracksByRef))
		.sort((left, right) => left.column.localeCompare(right.column) || left.rank.localeCompare(right.rank));
	const tracks = [
		...realTracks,
		...[...syntheticTracksByRef.values()].filter((track) => (
			track.source.kind !== "branch" || !branchTracksByRef.has(track.source.ref)
		)),
	].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));

	return {
		snapshotBase: {
			project: selectedSnapshot.project,
			metadata: selectedSnapshot.metadata,
			git: selected.git,
			board: activeBoard,
			boards: boardDescriptors,
			tracks,
			cards,
			storageRoot: selected.storageRoot ?? selectedSnapshot.storageRoot,
			boardRecords,
		},
		worktrees,
	};
}

/**
 * Removes runtime-only fields before snapshots cross the core/client boundary.
 */
export function stripInternalSnapshotFields(snapshot: ProjectSnapshotWithInternals | null): ProjectSnapshot | null {
	if (!snapshot) return snapshot;
	const { storageRoot: _storageRoot, boardRecords: _boardRecords, ...publicSnapshot } = snapshot;
	return publicSnapshot;
}

function syntheticTrackId(ref: string): string {
	return `synthetic-track:${ref}`;
}

function createSyntheticTrack(ref: string, boardId: string): Track {
	const timestamp = new Date().toISOString();
	return {
		id: syntheticTrackId(ref),
		boardId,
		title: ref,
		slug: ref,
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
		originWorktreeId: undefined,
		originStoragePath: undefined,
	};
}

function effectiveTrackIdForCard(
	card: Card,
	branchTracksByRef: Map<string, Track>,
	syntheticTracksByRef: Map<string, Track>,
	boardId: string,
): string | null {
	if (card.trackId) return card.trackId;
	if (card.scope.kind !== "track") return null;

	const existingTrack = branchTracksByRef.get(card.scope.ref);
	if (existingTrack) return existingTrack.id;

	const synthetic = syntheticTracksByRef.get(card.scope.ref) ?? createSyntheticTrack(card.scope.ref, boardId);
	syntheticTracksByRef.set(card.scope.ref, synthetic);
	return synthetic.id;
}

function mapCardToSelectedWorktree(
	card: Card,
	selected: WorktreeStore,
	boardId: string,
	branchTracksByRef: Map<string, Track>,
	syntheticTracksByRef: Map<string, Track>,
): Card {
	return {
		...card,
		boardId,
		scope: { kind: "project", ref: "global" },
		trackId: effectiveTrackIdForCard(card, branchTracksByRef, syntheticTracksByRef, boardId),
		originWorktreeId: selected.id,
		originStoragePath: selected.storagePath ?? undefined,
		worktreeIds: [selected.id],
		conflicted: false,
		variants: [{
			worktreeId: selected.id,
			worktreeName: selected.name,
			storagePath: selected.storagePath ?? ".trackboi",
			updatedAt: card.updatedAt,
			title: card.title,
			description: card.description,
			column: card.column,
			scope: { kind: "project", ref: "global" },
			trackId: effectiveTrackIdForCard(card, branchTracksByRef, syntheticTracksByRef, boardId),
		}],
	};
}

function pickActiveBoardId(
	boards: BoardDescriptor[],
	selectedBoardId: string | null,
	fallbackBoardId: string,
): string {
	if (selectedBoardId && boards.some((board) => board.id === selectedBoardId)) return selectedBoardId;
	if (boards.some((board) => board.id === fallbackBoardId)) return fallbackBoardId;
	if (boards.some((board) => board.id === DEFAULT_BOARD_ID)) return DEFAULT_BOARD_ID;
	return boards[0]?.id ?? fallbackBoardId;
}
