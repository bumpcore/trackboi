import { DEFAULT_BOARD_ID } from "./constants";
import { normalizeScope } from "./git";
import { newId } from "./id";
import { readJson, writeJsonAtomic } from "./json";
import { cardPath } from "./paths";
import { rankBetween } from "./rank";
import { deleteCardFile, now, type ProjectStore } from "./storage";
import type { Card, CardPatch, CreateCardInput, MoveCardInput, ProjectSnapshotWithInternals } from "./types";

/**
 * Creates a card at the end of its target column.
 *
 * The caller supplies the current snapshot so rank generation can happen with a
 * single read of the board state.
 */
export function createCardInStore(
	store: ProjectStore,
	snapshot: ProjectSnapshotWithInternals,
	input: CreateCardInput,
): Card {
	const title = input.title.trim();
	if (!title) throw new Error("Card title is required");

	const columnCards = snapshot.cards
		.filter((card) => card.column === input.column)
		.sort((left, right) => left.rank.localeCompare(right.rank));
	const timestamp = now();
	const card: Card = {
		id: newId("card"),
		boardId: DEFAULT_BOARD_ID,
		title,
		description: input.description?.trim() ?? "",
		parentId: input.parentId ?? null,
		scope: { kind: "project", ref: "global" },
		trackId: input.trackId ?? null,
		column: input.column,
		rank: rankBetween(columnCards.at(-1)?.rank ?? null, null),
		labels: [],
		assignee: null,
		fieldValues: {},
		comments: [],
		createdAt: timestamp,
		updatedAt: timestamp,
	};
	writeJsonAtomic(cardPath(store.rootPath, card.id), card);
	return card;
}

export function updateCardInStore(store: ProjectStore, cardId: string, patch: CardPatch): Card {
	const filePath = cardPath(store.rootPath, cardId);
	const next = applyCardPatch(readJson<Card>(filePath), patch);
	writeJsonAtomic(filePath, next);
	return next;
}

export function moveCardInStore(
	store: ProjectStore,
	snapshot: ProjectSnapshotWithInternals,
	input: MoveCardInput,
): Card {
	const moving = snapshot.cards.find((card) => card.id === input.cardId);
	if (!moving) throw new Error(`Unknown card: ${input.cardId}`);

	const targetCards = snapshot.cards
		.filter((card) => card.id !== input.cardId && card.column === input.toColumn)
		.sort((left, right) => left.rank.localeCompare(right.rank));
	const beforeIndex = input.beforeCardId
		? targetCards.findIndex((card) => card.id === input.beforeCardId)
		: -1;
	const previousRank = beforeIndex > 0
		? targetCards[beforeIndex - 1]?.rank ?? null
		: beforeIndex === 0
			? null
			: targetCards.at(-1)?.rank ?? null;
	const nextRank = beforeIndex >= 0 ? targetCards[beforeIndex]?.rank ?? null : null;

	return updateCardInStore(store, input.cardId, {
		column: input.toColumn,
		rank: rankBetween(previousRank, nextRank),
	});
}

export function deleteCardInStore(store: ProjectStore, cardId: string): { ok: true } {
	deleteCardFile(store.rootPath, cardId);
	return { ok: true };
}

/**
 * Applies a user/API patch while preserving fields not mentioned by the patch.
 */
function applyCardPatch(card: Card, patch: CardPatch): Card {
		const next: Card = {
			...card,
			trackId: card.trackId ?? null,
			fieldValues: card.fieldValues ?? {},
			comments: card.comments ?? [],
		};
	if (typeof patch.title === "string") next.title = patch.title.trim();
	if (typeof patch.description === "string") next.description = patch.description.trim();
	if ("parentId" in patch) next.parentId = patch.parentId ?? null;
	if (patch.scope) next.scope = normalizeScope(patch.scope);
	if ("trackId" in patch) {
		next.trackId = patch.trackId ?? null;
		next.scope = { kind: "project", ref: "global" };
	}
	if (typeof patch.column === "string") next.column = patch.column;
	if (typeof patch.rank === "string") next.rank = patch.rank;
	if (typeof patch.boardId === "string") next.boardId = patch.boardId;
	if (Array.isArray(patch.labels)) next.labels = patch.labels.filter((label) => typeof label === "string");
	if ("assignee" in patch) next.assignee = typeof patch.assignee === "string" ? patch.assignee : null;
	if (patch.fieldValues) next.fieldValues = patch.fieldValues;
	if (Array.isArray(patch.comments)) next.comments = patch.comments;
	if (!next.title.trim()) throw new Error("Card title is required");
	next.updatedAt = now();
	return next;
}
