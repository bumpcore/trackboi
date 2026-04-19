import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { writeFrontmatter } from "./frontmatter";
import { normalizeScope } from "./git";
import { newId } from "./id";
import { cardCommentPath, cardCommentsPath, cardPath } from "./paths";
import { rankBetween } from "./rank";
import { deleteCardFile, now, readCards, type ProjectStore } from "./storage";
import type { Card, CardComment, CardPatch, CreateCardCommentInput, CreateCardInput, MoveCardInput, ProjectSnapshotWithInternals } from "./types";

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
		boardId: input.boardId ?? snapshot.board.id,
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
		createdBy: input.actorId ?? "person_unknown",
		updatedBy: input.actorId ?? "person_unknown",
	};
	writeCardMarkdown(store, card);
	return card;
}

export function updateCardInStore(store: ProjectStore, cardId: string, patch: CardPatch): Card {
	const current = readCards(store.rootPath).find((card) => card.id === cardId);
	if (!current) throw new Error(`Unknown card: ${cardId}`);
	const next = applyCardPatch(current, patch);
	writeCardMarkdown(store, next);
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

export function addCardCommentInStore(
	store: ProjectStore,
	card: Card,
	input: CreateCardCommentInput,
): CardComment {
	const timestamp = now();
	const comment: CardComment = {
		id: newId("comment"),
		cardId: card.id,
		body: input.body.trim(),
		createdAt: timestamp,
		updatedAt: timestamp,
		createdBy: input.actorId ?? "person_unknown",
		updatedBy: input.actorId ?? "person_unknown",
	};
	mkdirSync(cardCommentsPath(store.rootPath, card.id), { recursive: true });
	writeCardCommentMarkdown(store, comment);
	writeCardMarkdown(store, {
		...card,
		updatedAt: timestamp,
		updatedBy: comment.updatedBy,
		comments: [...card.comments, comment],
	});
	return comment;
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
			createdBy: card.createdBy ?? "person_unknown",
			updatedBy: card.updatedBy ?? card.createdBy ?? "person_unknown",
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
	if (!next.title.trim()) throw new Error("Card title is required");
	next.updatedAt = now();
	if (typeof patch.actorId === "string" && patch.actorId) next.updatedBy = patch.actorId;
	return next;
}

function writeCardMarkdown(store: ProjectStore, card: Card): void {
	mkdirSync(path.dirname(cardPath(store.rootPath, card.id)), { recursive: true });
	const payload = writeFrontmatter({
		id: card.id,
		boardId: card.boardId,
		title: card.title,
		parentId: card.parentId,
		scope: card.scope,
		trackId: card.trackId,
		column: card.column,
		rank: card.rank,
		labels: card.labels,
		assignee: card.assignee,
		fieldValues: card.fieldValues,
		createdAt: card.createdAt,
		updatedAt: card.updatedAt,
		createdBy: card.createdBy,
		updatedBy: card.updatedBy,
	}, card.description);
	writeFileSync(cardPath(store.rootPath, card.id), payload, "utf8");
}

function writeCardCommentMarkdown(store: ProjectStore, comment: CardComment): void {
	const payload = writeFrontmatter({
		id: comment.id,
		cardId: comment.cardId,
		createdAt: comment.createdAt,
		updatedAt: comment.updatedAt,
		createdBy: comment.createdBy,
		updatedBy: comment.updatedBy,
	}, comment.body);
	writeFileSync(cardCommentPath(store.rootPath, comment.cardId, comment.id), payload, "utf8");
}
