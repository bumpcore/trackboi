import { basename, dirname, join, resolve } from "node:path";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	unlink,
} from "node:fs/promises";
import type { Board, Card, CardPatch, Project, ProjectSnapshot } from "../../shared/types";
import { rankBetween } from "./rank";

const TRACKBOI_DIR = ".trackboi";
const CARDS_DIR = "cards";

const DEFAULT_COLUMNS = [
	{ id: "todo", name: "To Do" },
	{ id: "doing", name: "Doing" },
	{ id: "done", name: "Done" },
];

function now() {
	return new Date().toISOString();
}

function boardPath(projectPath: string) {
	return join(projectPath, TRACKBOI_DIR, "board.json");
}

function cardsPath(projectPath: string) {
	return join(projectPath, TRACKBOI_DIR, CARDS_DIR);
}

function cardPath(projectPath: string, cardId: string) {
	return join(cardsPath(projectPath), `${cardId}.json`);
}

async function exists(path: string) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function atomicWriteJson(path: string, value: unknown) {
	const tempPath = `${path}.tmp`;
	await Bun.write(tempPath, `${JSON.stringify(value, null, "\t")}\n`);
	await rename(tempPath, path);
}

function asBoard(value: unknown): Board {
	if (typeof value !== "object" || value == null) {
		throw new Error("board.json must contain an object");
	}
	const board = value as Partial<Board>;
	if (board.version !== 1 || typeof board.name !== "string" || !Array.isArray(board.columns)) {
		throw new Error("board.json is not a Trackboi v1 board");
	}
	return {
		version: 1,
		name: board.name,
		columns: board.columns.map((column) => {
			if (
				typeof column !== "object" ||
				column == null ||
				typeof column.id !== "string" ||
				typeof column.name !== "string"
			) {
				throw new Error("board.json contains an invalid column");
			}
			return { id: column.id, name: column.name };
		}),
	};
}

function asCard(value: unknown, expectedId?: string): Card {
	if (typeof value !== "object" || value == null) {
		throw new Error("Card file must contain an object");
	}
	const card = value as Partial<Card>;
	if (
		typeof card.id !== "string" ||
		typeof card.title !== "string" ||
		typeof card.description !== "string" ||
		typeof card.column !== "string" ||
		typeof card.rank !== "string" ||
		!Array.isArray(card.labels) ||
		typeof card.createdAt !== "string" ||
		typeof card.updatedAt !== "string"
	) {
		throw new Error(`Invalid card file${expectedId ? `: ${expectedId}` : ""}`);
	}
	if (expectedId != null && card.id !== expectedId) {
		throw new Error(`Card id ${card.id} does not match filename ${expectedId}`);
	}
	return {
		id: card.id,
		title: card.title,
		description: card.description,
		column: card.column,
		rank: card.rank,
		labels: card.labels.filter((label): label is string => typeof label === "string"),
		assignee: typeof card.assignee === "string" ? card.assignee : null,
		createdAt: card.createdAt,
		updatedAt: card.updatedAt,
	};
}

async function readJson(path: string) {
	return JSON.parse(await readFile(path, "utf8")) as unknown;
}

export async function findNearestGitRoot(startPath: string) {
	let current = resolve(startPath);

	for (;;) {
		if (await exists(join(current, ".git"))) return current;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

export async function ensureProject(projectPath: string): Promise<ProjectSnapshot> {
	const resolvedPath = resolve(projectPath);
	await mkdir(cardsPath(resolvedPath), { recursive: true });

	if (!(await exists(boardPath(resolvedPath)))) {
		const board: Board = {
			version: 1,
			name: basename(resolvedPath),
			columns: DEFAULT_COLUMNS,
		};
		await atomicWriteJson(boardPath(resolvedPath), board);
	}

	return readProject(resolvedPath);
}

export async function readProject(projectPath: string): Promise<ProjectSnapshot> {
	const resolvedPath = resolve(projectPath);
	const board = asBoard(await readJson(boardPath(resolvedPath)));
	const entries = await readdir(cardsPath(resolvedPath), { withFileTypes: true });
	const cards = await Promise.all(
		entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
			.map(async (entry) => {
				const id = entry.name.replace(/\.json$/, "");
				return asCard(await readJson(join(cardsPath(resolvedPath), entry.name)), id);
			}),
	);

	cards.sort((left, right) => left.column.localeCompare(right.column) || left.rank.localeCompare(right.rank));

	const project: Project = {
		id: `project_${Buffer.from(resolvedPath).toString("base64url")}`,
		name: board.name,
		path: resolvedPath,
	};

	return { project, board, cards };
}

export async function createCard(projectPath: string, input: {
	title: string;
	description?: string;
	column: string;
}) {
	const snapshot = await readProject(projectPath);
	if (!snapshot.board.columns.some((column) => column.id === input.column)) {
		throw new Error(`Unknown column: ${input.column}`);
	}

	const columnCards = snapshot.cards
		.filter((card) => card.column === input.column)
		.sort((left, right) => left.rank.localeCompare(right.rank));
	const previous = columnCards.at(-1)?.rank ?? null;
	const timestamp = now();
	const card: Card = {
		id: `card_${crypto.randomUUID()}`,
		title: input.title.trim(),
		description: input.description?.trim() ?? "",
		column: input.column,
		rank: rankBetween(previous, null),
		labels: [],
		assignee: null,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	if (!card.title) throw new Error("Card title is required");

	await atomicWriteJson(cardPath(projectPath, card.id), card);
	return card;
}

export async function updateCard(projectPath: string, cardId: string, patch: CardPatch) {
	const current = asCard(await readJson(cardPath(projectPath, cardId)), cardId);
	const next: Card = {
		...current,
		...patch,
		id: current.id,
		createdAt: current.createdAt,
		updatedAt: now(),
	};

	if (!next.title.trim()) throw new Error("Card title is required");
	next.title = next.title.trim();
	next.description = next.description.trim();

	await atomicWriteJson(cardPath(projectPath, cardId), next);
	return next;
}

export async function moveCard(projectPath: string, cardId: string, toColumn: string, beforeCardId?: string | null) {
	const snapshot = await readProject(projectPath);
	if (!snapshot.board.columns.some((column) => column.id === toColumn)) {
		throw new Error(`Unknown column: ${toColumn}`);
	}

	const moving = snapshot.cards.find((card) => card.id === cardId);
	if (!moving) throw new Error(`Unknown card: ${cardId}`);

	const targetCards = snapshot.cards
		.filter((card) => card.id !== cardId && card.column === toColumn)
		.sort((left, right) => left.rank.localeCompare(right.rank));

	const beforeIndex = beforeCardId ? targetCards.findIndex((card) => card.id === beforeCardId) : -1;
	const previousRank = beforeIndex > 0
		? targetCards[beforeIndex - 1].rank
		: beforeIndex === 0
			? null
			: targetCards.at(-1)?.rank ?? null;
	const nextRank = beforeIndex >= 0 ? targetCards[beforeIndex].rank : null;

	const next: Card = {
		...moving,
		column: toColumn,
		rank: rankBetween(previousRank, nextRank),
		updatedAt: now(),
	};

	await atomicWriteJson(cardPath(projectPath, cardId), next);
	return next;
}

export async function deleteCard(projectPath: string, cardId: string) {
	await unlink(cardPath(projectPath, cardId));
	return { ok: true as const };
}
