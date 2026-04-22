import type { DesktopState, Track, Card } from "../../core";
import type { DesktopStorePatch } from "../bridge";

const PATCH_FALLBACK_THRESHOLD = 64;

function sameJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
	return new Map(items.map((item) => [item.id, item]));
}

function buildTrackPatches(previousTracks: Track[], nextTracks: Track[]): DesktopStorePatch[] {
	const patches: DesktopStorePatch[] = [];
	const previousById = mapById(previousTracks);
	const nextById = mapById(nextTracks);

	for (const track of previousTracks) {
		if (!nextById.has(track.id)) {
			patches.push({ type: "trackRemoved", trackId: track.id });
		}
	}

	for (const track of nextTracks) {
		const previous = previousById.get(track.id);
		if (!previous || !sameJson(previous, track)) {
			patches.push({ type: "trackUpserted", track });
		}
	}

	return patches;
}

function buildCardPatches(previousCards: Card[], nextCards: Card[]): DesktopStorePatch[] {
	const patches: DesktopStorePatch[] = [];
	const previousById = mapById(previousCards);
	const nextById = mapById(nextCards);

	for (const card of previousCards) {
		if (!nextById.has(card.id)) {
			patches.push({ type: "cardRemoved", cardId: card.id });
		}
	}

	for (const card of nextCards) {
		const previous = previousById.get(card.id);
		if (!previous || !sameJson(previous, card)) {
			patches.push({ type: "cardUpserted", card });
		}
	}

	return patches;
}

/**
 * Builds the smallest safe patch list we can confidently emit for an external
 * filesystem-driven desktop change. If the change crosses too many domains or
 * the diff gets too large, we fall back to a full context replacement.
 */
export function buildDesktopStorePatches(
	previous: DesktopState | null,
	next: DesktopState,
): DesktopStorePatch[] {
	if (!previous) return [{ type: "contextReplaced", state: next }];

	if (
		previous.view.activeProjectPath !== next.view.activeProjectPath
		|| previous.snapshot?.project.path !== next.snapshot?.project.path
		|| (previous.snapshot == null) !== (next.snapshot == null)
	) {
		return [{ type: "contextReplaced", state: next }];
	}

	const patches: DesktopStorePatch[] = [];

	if (!sameJson(previous.view, next.view)) {
		patches.push({ type: "viewUpdated", view: next.view });
	}

	if (
		previous.selectedWorktreeId !== next.selectedWorktreeId
		|| previous.selectedBoardId !== next.selectedBoardId
	) {
		patches.push({
			type: "selectionUpdated",
			selectedWorktreeId: next.selectedWorktreeId,
			selectedBoardId: next.selectedBoardId,
		});
	}

	if (!sameJson(previous.worktrees, next.worktrees)) {
		patches.push({
			type: "worktreesReplaced",
			projectPath: next.view.activeProjectPath,
			worktrees: next.worktrees,
		});
	}

	if (!next.snapshot || !previous.snapshot) {
		return patches.length > 0 ? patches : [];
	}

	if (!sameJson(previous.snapshot.metadata, next.snapshot.metadata)) {
		patches.push({ type: "metadataUpdated", metadata: next.snapshot.metadata });
	}

	if (
		!sameJson(previous.snapshot.board, next.snapshot.board)
		|| !sameJson(previous.snapshot.boards, next.snapshot.boards)
	) {
		patches.push({
			type: "boardUpserted",
			board: next.snapshot.board,
			boards: next.snapshot.boards,
			selectedBoardId: next.selectedBoardId,
		});
	}

	patches.push(...buildTrackPatches(previous.snapshot.tracks, next.snapshot.tracks));
	patches.push(...buildCardPatches(previous.snapshot.cards, next.snapshot.cards));

	if (patches.length > PATCH_FALLBACK_THRESHOLD) {
		return [{ type: "contextReplaced", state: next }];
	}

	return patches;
}
