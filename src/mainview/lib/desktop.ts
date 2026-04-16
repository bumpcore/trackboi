import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
	exists,
	mkdir,
	readDir,
	readTextFile,
	remove,
	rename,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { appConfigDir, basename, dirname, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { TrackboiRPCSchema } from "../../shared/rpc";
import type {
	Board,
	Card,
	CardPatch,
	FieldValue,
	GitContext,
	Project,
	ProjectIndex,
	ProjectIndexEntry,
	ProjectRegistry,
	ProjectSnapshot,
	WorkScope,
	WindowFrame,
} from "../../shared/types";

type BoardChangedListener = (snapshot: ProjectSnapshot | null) => void;
type ResizeDirection = "East" | "North" | "NorthEast" | "NorthWest" | "South" | "SouthEast" | "SouthWest" | "West";
type ElectrobunRpc = ReturnType<
	typeof import("electrobun/view").Electroview.defineRPC<TrackboiRPCSchema>
>;

const isTauri = "__TAURI_INTERNALS__" in window;
const listeners = new Set<BoardChangedListener>();
let electrobunRpc: ElectrobunRpc | null = null;

async function getElectrobunRpc() {
	if (electrobunRpc) return electrobunRpc;

	const { Electroview } = await import("electrobun/view");
	electrobunRpc = Electroview.defineRPC<TrackboiRPCSchema>({
		maxRequestTime: 10_000,
		handlers: {
			requests: {},
			messages: {},
		},
	});
	new Electroview({ rpc: electrobunRpc });

	for (const listener of listeners) {
		electrobunRpc.addMessageListener("boardChanged", listener);
	}

	return electrobunRpc;
}

const DEFAULT_COLUMNS = [
	{ id: "todo", name: "To Do" },
	{ id: "doing", name: "Doing" },
	{ id: "done", name: "Done" },
];
const DEFAULT_STORAGE_SEARCH_PATHS = [".etc/.trackboi", ".etc/trackboi", ".trackboi"];
const PROJECT_METADATA_FILE = "project.json";
const DEFAULT_BOARD_ID = "default";

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MIN_DIGIT = 0;
const MAX_DIGIT = DIGITS.length - 1;
const MID_DIGIT = Math.floor(MAX_DIGIT / 2);

function now() {
	return new Date().toISOString();
}

function globalScope(): WorkScope {
	return { kind: "project", ref: "global" };
}

function scopeForGitContext(git: GitContext): WorkScope {
	return git.branch ? { kind: "branch", ref: git.branch } : globalScope();
}

function digitAt(value: string | null, index: number, fallback: number) {
	if (value == null || index >= value.length) return fallback;
	const digit = DIGITS.indexOf(value[index]);
	if (digit === -1) {
		throw new Error(`Invalid rank character: ${value[index]}`);
	}
	return digit;
}

function rankBetween(before: string | null, after: string | null) {
	if (before != null && after != null && before >= after) {
		throw new Error(`Cannot rank between ${before} and ${after}`);
	}

	let prefix = "";

	for (let index = 0; ; index += 1) {
		const low = digitAt(before, index, MIN_DIGIT);
		const high = digitAt(after, index, MAX_DIGIT);

		if (high - low > 1) {
			return `${prefix}${DIGITS[Math.floor((low + high) / 2)]}`;
		}

		prefix += DIGITS[low] ?? DIGITS[MID_DIGIT];
	}
}

async function registryPath() {
	return join(await appConfigDir(), "config.json");
}

async function storageRoot(projectPath: string, storagePath: string) {
	return join(projectPath, storagePath);
}

async function cardsPath(rootPath: string) {
	return join(rootPath, "cards");
}

async function boardsPath(rootPath: string) {
	return join(rootPath, "boards");
}

async function boardPath(rootPath: string) {
	return join(await boardsPath(rootPath), `${DEFAULT_BOARD_ID}.json`);
}

async function projectMetadataPath(rootPath: string) {
	return join(rootPath, PROJECT_METADATA_FILE);
}

async function cardPath(rootPath: string, cardId: string) {
	return join(await cardsPath(rootPath), `${cardId}.json`);
}

async function atomicWriteJson(path: string, value: unknown) {
	const tempPath = `${path}.tmp`;
	await writeTextFile(tempPath, `${JSON.stringify(value, null, "\t")}\n`);
	await rename(tempPath, path);
}

async function readJson(path: string) {
	return JSON.parse(await readTextFile(path)) as unknown;
}

function emptyRegistry(): ProjectRegistry {
	return { projects: [], activeProjectId: null, storageSearchPaths: DEFAULT_STORAGE_SEARCH_PATHS };
}

function normalizeStorageSearchPaths(paths: string[]) {
	const normalized: string[] = [];

	for (const path of paths) {
		const nextPath = path.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
		if (!nextPath || nextPath.startsWith("/") || nextPath.split("/").includes("..")) {
			throw new Error("Storage paths must be relative paths inside the project");
		}
		if (!normalized.includes(nextPath)) normalized.push(nextPath);
	}

	if (normalized.length === 0) {
		throw new Error("Add at least one storage search path");
	}

	return normalized;
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
		customFields: Array.isArray(board.customFields)
			? board.customFields.flatMap((field) => {
				if (
					typeof field !== "object" ||
					field == null ||
					typeof field.id !== "string" ||
					typeof field.name !== "string" ||
					!["text", "number", "checkbox", "select", "date"].includes(String(field.type))
				) {
					return [];
				}

				return [{
					id: field.id,
					name: field.name,
					type: field.type,
					options: Array.isArray(field.options)
						? field.options.filter((option): option is string => typeof option === "string")
						: undefined,
				}];
			})
			: [],
	};
}

function asFieldValues(value: unknown): Record<string, FieldValue> {
	if (typeof value !== "object" || value == null || Array.isArray(value)) return {};
	const values: Record<string, FieldValue> = {};
	for (const [key, fieldValue] of Object.entries(value)) {
		if (
			typeof fieldValue === "string" ||
			typeof fieldValue === "number" ||
			typeof fieldValue === "boolean" ||
			fieldValue == null
		) {
			values[key] = fieldValue;
		}
	}
	return values;
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
		parentId: typeof card.parentId === "string" ? card.parentId : null,
		scope: asScope(card.scope),
		column: card.column,
		rank: card.rank,
		labels: card.labels.filter((label): label is string => typeof label === "string"),
		assignee: typeof card.assignee === "string" ? card.assignee : null,
		fieldValues: asFieldValues(card.fieldValues),
		createdAt: card.createdAt,
		updatedAt: card.updatedAt,
	};
}

function asScope(value: unknown): WorkScope {
	if (typeof value !== "object" || value == null) return globalScope();

	const scope = value as Partial<WorkScope>;
	if (scope.kind === "branch" && typeof scope.ref === "string" && scope.ref.trim() !== "") {
		return { kind: "branch", ref: scope.ref };
	}
	if (scope.kind === "project") return globalScope();

	return globalScope();
}

function asRegistry(value: unknown): ProjectRegistry {
	if (typeof value !== "object" || value == null) {
		return emptyRegistry();
	}

	const registry = value as Partial<ProjectRegistry>;
	const projects = Array.isArray(registry.projects)
		? registry.projects.filter((project): project is Project =>
				typeof project === "object" &&
				project != null &&
				typeof project.id === "string" &&
				typeof project.name === "string" &&
				typeof project.path === "string",
			)
			.map((project) => ({
				id: project.id,
				name: project.name,
				path: project.path,
				...(typeof project.storagePath === "string" ? { storagePath: project.storagePath } : {}),
			}))
		: [];
	const activeProjectId = typeof registry.activeProjectId === "string"
		? registry.activeProjectId
		: null;
	let storageSearchPaths = DEFAULT_STORAGE_SEARCH_PATHS;
	try {
		storageSearchPaths = Array.isArray(registry.storageSearchPaths)
			? normalizeStorageSearchPaths(registry.storageSearchPaths)
			: DEFAULT_STORAGE_SEARCH_PATHS;
	} catch {
		storageSearchPaths = DEFAULT_STORAGE_SEARCH_PATHS;
	}

	return {
		projects,
		activeProjectId: projects.some((project) => project.id === activeProjectId)
			? activeProjectId
			: projects[0]?.id ?? null,
		storageSearchPaths: storageSearchPaths.length > 0 ? storageSearchPaths : DEFAULT_STORAGE_SEARCH_PATHS,
	};
}

async function readRegistry(): Promise<ProjectRegistry> {
	try {
		return asRegistry(await readJson(await registryPath()));
	} catch {
		return emptyRegistry();
	}
}

async function writeRegistry(registry: ProjectRegistry) {
	const path = await registryPath();
	await mkdir(await dirname(path), { recursive: true });
	const nextRegistry = asRegistry(registry);
	await atomicWriteJson(path, nextRegistry);
	return nextRegistry;
}

function activeProjectFromRegistry(registry: ProjectRegistry) {
	return registry.projects.find((project) => project.id === registry.activeProjectId) ?? null;
}

function storageCandidates(registry: ProjectRegistry, project?: Project) {
	const configured = registry.storageSearchPaths?.length
		? registry.storageSearchPaths
		: DEFAULT_STORAGE_SEARCH_PATHS;
	return [
		...(project?.storagePath ? [project.storagePath] : []),
		...configured.filter((path) => path !== project?.storagePath),
	];
}

async function storageExists(rootPath: string) {
	return (
		(await exists(await boardPath(rootPath))) ||
		(await exists(await projectMetadataPath(rootPath))) ||
		(await exists(await cardsPath(rootPath)))
	);
}

async function findGitRoot(startPath: string) {
	let currentPath = startPath;

	for (let depth = 0; depth < 64; depth += 1) {
		if (await exists(await join(currentPath, ".git"))) return currentPath;

		const parentPath = await dirname(currentPath);
		if (parentPath === currentPath) return null;
		currentPath = parentPath;
	}

	return null;
}

async function readGitContext(projectPath: string): Promise<GitContext> {
	const root = await findGitRoot(projectPath);
	if (!root) {
		return { isGitRepo: false, root: null, branch: null, detached: false, dirty: null };
	}

	try {
		const head = (await readTextFile(await join(root, ".git", "HEAD"))).trim();
		const prefix = "ref: refs/heads/";
		const branch = head.startsWith(prefix) ? head.slice(prefix.length) : null;

		return {
			isGitRepo: true,
			root,
			branch,
			detached: branch == null,
			dirty: null,
		};
	} catch {
		return { isGitRepo: true, root, branch: null, detached: false, dirty: null };
	}
}

async function resolveProjectStorage(
	project: Project,
	registry: ProjectRegistry,
	options: { create: boolean },
) {
	for (const candidate of storageCandidates(registry, project)) {
		const rootPath = await storageRoot(project.path, candidate);
		if (await storageExists(rootPath)) {
			return { rootPath, storagePath: candidate };
		}
	}

	if (!options.create) return null;
	const storagePath = storageCandidates(registry, project)[0] ?? DEFAULT_STORAGE_SEARCH_PATHS[0];
	return { rootPath: await storageRoot(project.path, storagePath), storagePath };
}

async function writeProjectMetadata(rootPath: string, project: Project, storagePath: string) {
	const metadataPath = await projectMetadataPath(rootPath);
	if (await exists(metadataPath)) return;

	await atomicWriteJson(metadataPath, {
		version: 1,
		projectId: project.id,
		name: project.name,
		storagePath,
		createdAt: now(),
	});
}

async function rememberProjectStorage(projectId: string, storagePath: string) {
	const registry = await readRegistry();
	const project = registry.projects.find((project) => project.id === projectId);
	if (!project || project.storagePath === storagePath) return registry;

	project.storagePath = storagePath;
	return writeRegistry(registry);
}

async function projectStatus(project: Project, registry: ProjectRegistry): Promise<ProjectIndexEntry["status"]> {
	if (!(await exists(project.path))) return "missing";
	const storage = await resolveProjectStorage(project, registry, { create: false });
	if (!storage) return "uninitialized";
	if (!(await exists(await boardPath(storage.rootPath)))) return "uninitialized";
	return "ready";
}

async function readProjectIndex(): Promise<ProjectIndex> {
	const registry = await readRegistry();
	const projects = await Promise.all(
		registry.projects.map(async (project): Promise<ProjectIndexEntry> => ({
			...project,
			status: await projectStatus(project, registry),
		})),
	);

	return {
		projects,
		activeProjectId: registry.activeProjectId,
		storageSearchPaths: storageCandidates(registry),
	};
}

async function writeStorageSearchPaths(paths: string[]) {
	const registry = await readRegistry();
	registry.storageSearchPaths = normalizeStorageSearchPaths(paths);
	await writeRegistry(registry);
	return readProjectIndex();
}

async function addProjectToRegistry(projectPath: string) {
	const registry = await readRegistry();
	const existingProject = registry.projects.find((project) => project.path === projectPath);

	if (existingProject) {
		registry.activeProjectId = existingProject.id;
		await writeRegistry(registry);
		return existingProject;
	}

	const project: Project = {
		id: `project_${crypto.randomUUID()}`,
		name: await basename(projectPath),
		path: projectPath,
		storagePath: (await resolveProjectStorage(
			{ id: "", name: "", path: projectPath },
			registry,
			{ create: true },
		))?.storagePath ?? DEFAULT_STORAGE_SEARCH_PATHS[0],
	};

	registry.projects.push(project);
	registry.activeProjectId = project.id;
	await writeRegistry(registry);
	return project;
}

async function removeProjectFromRegistry(projectId: string) {
	const registry = await readRegistry();
	const nextProjects = registry.projects.filter((project) => project.id !== projectId);

	if (nextProjects.length === registry.projects.length) {
		throw new Error(`Unknown project: ${projectId}`);
	}

	const activeProjectId = registry.activeProjectId === projectId
		? nextProjects[0]?.id ?? null
		: registry.activeProjectId;
	await writeRegistry({ ...registry, projects: nextProjects, activeProjectId });
	return activeSnapshot();
}

async function updateProjectPath(projectId: string, projectPath: string) {
	const registry = await readRegistry();
	const current = registry.projects.find((project) => project.id === projectId);
	if (!current) throw new Error(`Unknown project: ${projectId}`);

	const duplicate = registry.projects.find((project) => project.id !== projectId && project.path === projectPath);
	if (duplicate) {
		registry.projects = registry.projects.filter((project) => project.id !== projectId);
		registry.activeProjectId = duplicate.id;
		await writeRegistry(registry);
		return ensureProject(duplicate);
	}

	current.path = projectPath;
	current.name = await basename(projectPath);
	current.storagePath = (await resolveProjectStorage(current, registry, { create: true }))?.storagePath;
	registry.activeProjectId = current.id;
	await writeRegistry(registry);
	return ensureProject(current);
}

async function ensureProject(project: Project): Promise<ProjectSnapshot> {
	const registry = await readRegistry();
	const storage = await resolveProjectStorage(project, registry, { create: true });
	if (!storage) throw new Error("Unable to resolve Trackboi storage path");

	await mkdir(await boardsPath(storage.rootPath), { recursive: true });
	await mkdir(await cardsPath(storage.rootPath), { recursive: true });
	await writeProjectMetadata(storage.rootPath, project, storage.storagePath);

	const path = await boardPath(storage.rootPath);
	if (!(await exists(path))) {
		const board: Board = {
			version: 1,
			name: project.name || await basename(project.path),
			columns: DEFAULT_COLUMNS,
			customFields: [],
		};
		await atomicWriteJson(path, board);
	}

	await rememberProjectStorage(project.id, storage.storagePath);
	return readProject({ ...project, storagePath: storage.storagePath });
}

async function readProject(project: Project): Promise<ProjectSnapshot> {
	const registry = await readRegistry();
	const storage = await resolveProjectStorage(project, registry, { create: false });
	if (!storage) throw new Error("Trackboi storage has not been created for this project");

	const board = asBoard(await readJson(await boardPath(storage.rootPath)));
	const cardDir = await cardsPath(storage.rootPath);
	const entries = await readDir(cardDir);
	const cards = await Promise.all(
		entries
			.filter((entry) => entry.isFile && entry.name.endsWith(".json"))
			.map(async (entry) => {
				const id = entry.name.replace(/\.json$/, "");
				return asCard(await readJson(await join(cardDir, entry.name)), id);
			}),
	);

	cards.sort((left, right) => left.column.localeCompare(right.column) || left.rank.localeCompare(right.rank));
	const git = await readGitContext(project.path);

	return {
		project: {
			...project,
			name: project.name || board.name,
			storagePath: storage.storagePath,
		},
		git,
		board,
		cards,
	};
}

async function activeSnapshot() {
	const activeProject = activeProjectFromRegistry(await readRegistry());
	if (!activeProject) return null;
	if (!(await exists(activeProject.path))) return null;
	return ensureProject(activeProject);
}

async function broadcastBoardChanged() {
	const snapshot = await activeSnapshot();
	for (const listener of listeners) listener(snapshot);
	return snapshot;
}

async function requireActiveProject() {
	const activeProject = activeProjectFromRegistry(await readRegistry());
	if (!activeProject) throw new Error("Choose a project first");
	return activeProject;
}

async function tauriChooseProject() {
	const selected = await openDialog({
		directory: true,
		multiple: false,
	});

	if (typeof selected !== "string") return activeSnapshot();

	const project = await addProjectToRegistry(selected);
	const snapshot = await ensureProject(project);
	for (const listener of listeners) listener(snapshot);
	return snapshot;
}

async function tauriLocateProject(projectId: string) {
	const selected = await openDialog({
		directory: true,
		multiple: false,
	});

	if (typeof selected !== "string") return activeSnapshot();
	const snapshot = await updateProjectPath(projectId, selected);
	for (const listener of listeners) listener(snapshot);
	return snapshot;
}

async function tauriCreateCard(input: {
	title: string;
	description?: string;
	parentId?: string | null;
	column: string;
	scope?: WorkScope;
}) {
	const project = await requireActiveProject();
	const registry = await readRegistry();
	const storage = await resolveProjectStorage(project, registry, { create: true });
	if (!storage) throw new Error("Unable to resolve Trackboi storage path");
	const snapshot = await readProject(project);
	const columnCards = snapshot.cards
		.filter((card) => card.column === input.column)
		.sort((left, right) => left.rank.localeCompare(right.rank));
	const timestamp = now();
	const card: Card = {
		id: `card_${crypto.randomUUID()}`,
		title: input.title.trim(),
		description: input.description?.trim() ?? "",
		parentId: input.parentId ?? null,
		scope: input.scope ?? scopeForGitContext(snapshot.git),
		column: input.column,
		rank: rankBetween(columnCards.at(-1)?.rank ?? null, null),
		labels: [],
		assignee: null,
		fieldValues: {},
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	if (!card.title) throw new Error("Card title is required");
	await atomicWriteJson(await cardPath(storage.rootPath, card.id), card);
	await broadcastBoardChanged();
	return card;
}

async function tauriUpdateCard(cardId: string, patch: CardPatch) {
	const project = await requireActiveProject();
	const registry = await readRegistry();
	const storage = await resolveProjectStorage(project, registry, { create: false });
	if (!storage) throw new Error("Trackboi storage has not been created for this project");
	const current = asCard(await readJson(await cardPath(storage.rootPath, cardId)), cardId);
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

	await atomicWriteJson(await cardPath(storage.rootPath, cardId), next);
	await broadcastBoardChanged();
	return next;
}

async function tauriUpdateBoard(board: Board) {
	const project = await requireActiveProject();
	const registry = await readRegistry();
	const storage = await resolveProjectStorage(project, registry, { create: false });
	if (!storage) throw new Error("Trackboi storage has not been created for this project");

	const next = asBoard(board);
	await atomicWriteJson(await boardPath(storage.rootPath), next);
	await broadcastBoardChanged();
	return next;
}

async function tauriMoveCard(cardId: string, toColumn: string, beforeCardId?: string | null) {
	const project = await requireActiveProject();
	const registry = await readRegistry();
	const storage = await resolveProjectStorage(project, registry, { create: false });
	if (!storage) throw new Error("Trackboi storage has not been created for this project");
	const snapshot = await readProject(project);
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

	await atomicWriteJson(await cardPath(storage.rootPath, cardId), next);
	await broadcastBoardChanged();
	return next;
}

async function tauriDeleteCard(cardId: string) {
	const project = await requireActiveProject();
	const registry = await readRegistry();
	const storage = await resolveProjectStorage(project, registry, { create: false });
	if (!storage) throw new Error("Trackboi storage has not been created for this project");
	await remove(await cardPath(storage.rootPath, cardId));
	await broadcastBoardChanged();
	return { ok: true as const };
}

function toResizeDirection(edge: string): ResizeDirection {
	const map: Record<string, ResizeDirection> = {
		n: "North",
		e: "East",
		s: "South",
		w: "West",
		ne: "NorthEast",
		nw: "NorthWest",
		se: "SouthEast",
		sw: "SouthWest",
	};
	return map[edge];
}

const tauriWindow = () => getCurrentWindow();

export const desktop = {
	isTauri,
	async getActiveProject() {
		return isTauri ? activeSnapshot() : (await getElectrobunRpc()).request.getActiveProject();
	},
	async listProjects() {
		return isTauri ? readRegistry() : (await getElectrobunRpc()).request.listProjects();
	},
	async listProjectIndex() {
		if (isTauri) return readProjectIndex();
		const registry = await (await getElectrobunRpc()).request.listProjects();
		return {
			projects: registry.projects.map((project) => ({ ...project, status: "ready" as const })),
			activeProjectId: registry.activeProjectId,
			storageSearchPaths: DEFAULT_STORAGE_SEARCH_PATHS,
		};
	},
	async setStorageSearchPaths(paths: string[]) {
		if (isTauri) return writeStorageSearchPaths(paths);
		throw new Error("Storage search path settings are only available in the Tauri shell");
	},
	async chooseProject() {
		return isTauri ? tauriChooseProject() : (await getElectrobunRpc()).request.chooseProject();
	},
	async locateProject(projectId: string) {
		if (isTauri) return tauriLocateProject(projectId);
		throw new Error("Project location is only available in the Tauri shell");
	},
	async removeProject(projectId: string) {
		if (isTauri) return removeProjectFromRegistry(projectId);
		throw new Error("Project removal is only available in the Tauri shell");
	},
	async switchProject(projectId: string) {
		if (!isTauri) return (await getElectrobunRpc()).request.switchProject({ projectId });
		const registry = await readRegistry();
		if (!registry.projects.some((project) => project.id === projectId)) {
			throw new Error(`Unknown project: ${projectId}`);
		}
		registry.activeProjectId = projectId;
		await writeRegistry(registry);
		return broadcastBoardChanged();
	},
	async createCard(input: {
		title: string;
		description?: string;
		parentId?: string | null;
		column: string;
		scope?: WorkScope;
	}) {
		return isTauri ? tauriCreateCard(input) : (await getElectrobunRpc()).request.createCard(input);
	},
	async updateCard(cardId: string, patch: CardPatch) {
		return isTauri
			? tauriUpdateCard(cardId, patch)
			: (await getElectrobunRpc()).request.updateCard({ cardId, patch });
	},
	async updateBoard(board: Board) {
		if (isTauri) return tauriUpdateBoard(board);
		throw new Error("Board settings are only available in the Tauri shell");
	},
	async moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
		return isTauri
			? tauriMoveCard(cardId, toColumn, beforeCardId)
			: (await getElectrobunRpc()).request.moveCard({ cardId, toColumn, beforeCardId });
	},
	async deleteCard(cardId: string) {
		return isTauri ? tauriDeleteCard(cardId) : (await getElectrobunRpc()).request.deleteCard({ cardId });
	},
	async minimizeWindow() {
		if (isTauri) {
			await tauriWindow().minimize();
			return { ok: true as const };
		}
		return (await getElectrobunRpc()).request.minimizeWindow();
	},
	async toggleMaximizeWindow() {
		if (isTauri) {
			const window = tauriWindow();
			if (await window.isMaximized()) await window.unmaximize();
			else await window.maximize();
			return { ok: true as const };
		}
		return (await getElectrobunRpc()).request.toggleMaximizeWindow();
	},
	async closeWindow() {
		if (isTauri) {
			await tauriWindow().close();
			return { ok: true as const };
		}
		return (await getElectrobunRpc()).request.closeWindow();
	},
	async startWindowDrag() {
		if (isTauri) {
			const window = tauriWindow();
			if (await window.isMaximized()) {
				await window.unmaximize();
			}
			await window.setFocus();
			await window.startDragging();
		}
	},
	async startResize(edge: string) {
		if (isTauri) {
			const window = tauriWindow();
			await window.setFocus();
			await window.startResizeDragging(toResizeDirection(edge));
		}
	},
	async getWindowFrame(): Promise<WindowFrame> {
		if (!isTauri) return (await getElectrobunRpc()).request.getWindowFrame();
		const [position, size] = await Promise.all([
			tauriWindow().outerPosition(),
			tauriWindow().outerSize(),
		]);
		return { x: position.x, y: position.y, width: size.width, height: size.height };
	},
	async setWindowFrame(frame: WindowFrame) {
		if (!isTauri) return (await getElectrobunRpc()).request.setWindowFrame(frame);
		await Promise.all([
			tauriWindow().setPosition(new PhysicalPosition(frame.x, frame.y)),
			tauriWindow().setSize(new PhysicalSize(frame.width, frame.height)),
		]);
		return { ok: true as const };
	},
	addBoardChangedListener(listener: BoardChangedListener) {
		listeners.add(listener);
		if (!isTauri) void getElectrobunRpc().then((rpc) => rpc.addMessageListener("boardChanged", listener));
	},
};
