const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const DEFAULT_BOARD_ID = "default";
const PROJECT_METADATA_FILE = "project.json";
const STORAGE_SEARCH_PATHS = [".trackboi", ".etc/.trackboi", ".etc/trackboi"];

let mainWindow = null;
let activeWatchers = [];
let watcherTimer = null;

function now() {
	return new Date().toISOString();
}

function newId(prefix) {
	return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(8).toString("hex")}`;
}

function appConfigPath() {
	return path.join(app.getPath("userData"), "config.json");
}

function legacyConfigPaths() {
	return [
		path.join(os.homedir(), ".config", "dev.bumpcore.trackboi", "config.json"),
		path.join(os.homedir(), ".config", "trackboi", "config.json"),
	];
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonAtomic(filePath, value) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.tmp`;
	fs.writeFileSync(tempPath, `${JSON.stringify(value, null, "\t")}\n`);
	fs.renameSync(tempPath, filePath);
}

function defaultRegistry() {
	return {
		projects: [],
		activeProjectId: null,
		storageSearchPaths: [...STORAGE_SEARCH_PATHS],
		activeWorkspaceFile: null,
	};
}

function normalizeStorageSearchPaths(paths) {
	const normalized = [];
	for (const rawPath of paths) {
		const nextPath = String(rawPath).trim().replaceAll("\\", "/").replace(/^\.\//, "");
		if (
			!nextPath ||
			path.posix.isAbsolute(nextPath) ||
			nextPath.split("/").some((part) => part === "..")
		) {
			throw new Error("Storage paths must be relative paths inside the project");
		}
		if (!normalized.includes(nextPath)) normalized.push(nextPath);
	}
	if (normalized.length === 0) throw new Error("Add at least one storage search path");
	return normalized;
}

function sanitizeRegistry(registry) {
	const storageSearchPaths = Array.isArray(registry.storageSearchPaths)
		? normalizeStorageSearchPaths(registry.storageSearchPaths)
		: [...STORAGE_SEARCH_PATHS];

	return {
		projects: Array.isArray(registry.projects) ? registry.projects : [],
		activeProjectId: registry.activeProjectId ?? registry.projects?.[0]?.id ?? null,
		storageSearchPaths,
		activeWorkspaceFile: registry.activeWorkspaceFile ?? null,
	};
}

function readRegistry() {
	for (const candidatePath of [appConfigPath(), ...legacyConfigPaths()]) {
		try {
			const registry = sanitizeRegistry(readJson(candidatePath));
			if (candidatePath !== appConfigPath()) writeJsonAtomic(appConfigPath(), registry);
			return registry;
		} catch {
			// Try the next known registry location.
		}
	}

	return defaultRegistry();
}

function writeRegistry(registry) {
	const nextRegistry = sanitizeRegistry(registry);
	writeJsonAtomic(appConfigPath(), nextRegistry);
	return nextRegistry;
}

function projectName(projectPath) {
	return path.basename(projectPath) || "Project";
}

function storageRoot(projectPath, storagePath) {
	return path.join(projectPath, storagePath);
}

function boardsPath(rootPath) {
	return path.join(rootPath, "boards");
}

function boardPath(rootPath) {
	return path.join(boardsPath(rootPath), `${DEFAULT_BOARD_ID}.json`);
}

function cardsPath(rootPath) {
	return path.join(rootPath, "cards");
}

function cardPath(rootPath, cardId) {
	return path.join(cardsPath(rootPath), `${cardId}.json`);
}

function projectMetadataPath(rootPath) {
	return path.join(rootPath, PROJECT_METADATA_FILE);
}

function defaultColumns() {
	return [
		{ id: "todo", name: "To Do" },
		{ id: "doing", name: "Doing" },
		{ id: "done", name: "Done" },
	];
}

function storageExists(rootPath) {
	return fs.existsSync(boardPath(rootPath)) ||
		fs.existsSync(projectMetadataPath(rootPath)) ||
		fs.existsSync(cardsPath(rootPath));
}

function storageCandidates(registry, project = null) {
	const candidates = [];
	if (project?.storagePath) candidates.push(project.storagePath);
	for (const candidate of registry.storageSearchPaths ?? STORAGE_SEARCH_PATHS) {
		if (!candidates.includes(candidate)) candidates.push(candidate);
	}
	return candidates;
}

function initialStoragePath(project, registry) {
	const candidates = storageCandidates(registry, project);
	if (
		JSON.stringify(candidates) === JSON.stringify(STORAGE_SEARCH_PATHS) &&
		fs.existsSync(path.join(project.path, ".etc"))
	) {
		return ".etc/.trackboi";
	}
	return candidates[0] ?? STORAGE_SEARCH_PATHS[0];
}

function resolveProjectStorage(project, registry, create) {
	for (const candidate of storageCandidates(registry, project)) {
		const rootPath = storageRoot(project.path, candidate);
		if (storageExists(rootPath)) return { rootPath, storagePath: candidate };
	}
	if (!create) return null;
	const storagePath = initialStoragePath(project, registry);
	return { rootPath: storageRoot(project.path, storagePath), storagePath };
}

function globalScope() {
	return { kind: "project", ref: "global" };
}

function normalizeScope(scope) {
	if (scope?.kind === "branch" && String(scope.ref ?? "").trim()) return scope;
	return globalScope();
}

function findGitRoot(startPath) {
	let current = startPath;
	for (let index = 0; index < 64; index += 1) {
		if (fs.existsSync(path.join(current, ".git"))) return current;
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
	return null;
}

function readGitContext(projectPath) {
	const root = findGitRoot(projectPath);
	if (!root) {
		return { isGitRepo: false, root: null, branch: null, detached: false, dirty: null };
	}

	let branch = null;
	try {
		const head = fs.readFileSync(path.join(root, ".git", "HEAD"), "utf8").trim();
		branch = head.startsWith("ref: refs/heads/") ? head.slice("ref: refs/heads/".length) : null;
	} catch {
		branch = null;
	}

	let dirty = null;
	try {
		dirty = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).length > 0;
	} catch {
		dirty = null;
	}

	return { isGitRepo: true, root, branch, detached: branch == null, dirty };
}

function scopeForGitContext(git) {
	return git.branch ? { kind: "branch", ref: git.branch } : globalScope();
}

function ensureProjectFiles(project, rootPath, storagePath) {
	fs.mkdirSync(boardsPath(rootPath), { recursive: true });
	fs.mkdirSync(cardsPath(rootPath), { recursive: true });

	const metadataPath = projectMetadataPath(rootPath);
	if (!fs.existsSync(metadataPath)) {
		writeJsonAtomic(metadataPath, {
			version: 1,
			projectId: project.id,
			name: project.name,
			storagePath,
			createdAt: now(),
			customFields: [],
		});
	}

	const defaultBoardPath = boardPath(rootPath);
	if (!fs.existsSync(defaultBoardPath)) {
		writeJsonAtomic(defaultBoardPath, {
			version: 1,
			name: project.name || projectName(project.path),
			columns: defaultColumns(),
			customFields: [],
		});
	}
}

function openStore(project, registry, create) {
	const resolved = resolveProjectStorage(project, registry, create);
	if (!resolved) throw new Error("Trackboi storage has not been created for this project");
	return {
		project: { ...project, storagePath: resolved.storagePath },
		rootPath: resolved.rootPath,
		storagePath: resolved.storagePath,
	};
}

function projectFromMetadata(store) {
	try {
		const metadata = readJson(projectMetadataPath(store.rootPath));
		return {
			id: metadata.projectId,
			name: metadata.name,
			path: store.project.path,
			storagePath: store.storagePath,
		};
	} catch {
		return store.project;
	}
}

function rememberProjectStorage(projectId, storagePath) {
	const registry = readRegistry();
	const project = registry.projects.find((entry) => entry.id === projectId);
	if (project && project.storagePath !== storagePath) {
		project.storagePath = storagePath;
		writeRegistry(registry);
	}
}

function readSnapshotForProject(project, create = true) {
	const registry = readRegistry();
	const store = openStore(project, registry, create);
	ensureProjectFiles(store.project, store.rootPath, store.storagePath);
	rememberProjectStorage(store.project.id, store.storagePath);

	let metadata = readJson(projectMetadataPath(store.rootPath));
	const board = readJson(boardPath(store.rootPath));
	if ((!metadata.customFields || metadata.customFields.length === 0) && board.customFields?.length > 0) {
		metadata = { ...metadata, customFields: board.customFields };
		writeJsonAtomic(projectMetadataPath(store.rootPath), metadata);
	}

	const cards = [];
	const cardDir = cardsPath(store.rootPath);
	if (fs.existsSync(cardDir)) {
		for (const filename of fs.readdirSync(cardDir)) {
			if (!filename.endsWith(".json")) continue;
			const filePath = path.join(cardDir, filename);
			if (!fs.statSync(filePath).isFile()) continue;
			const card = readJson(filePath);
			const id = path.basename(filename, ".json");
			if (card.id !== id) throw new Error(`Card id ${card.id} does not match filename ${id}`);
			card.scope = normalizeScope(card.scope);
			card.boardId ??= DEFAULT_BOARD_ID;
			card.fieldValues ??= {};
			if (card.boardId === DEFAULT_BOARD_ID) cards.push(card);
		}
	}
	cards.sort((left, right) => left.column.localeCompare(right.column) || left.rank.localeCompare(right.rank));

	const nextProject = projectFromMetadata(store);
	const snapshot = {
		project: nextProject,
		metadata,
		git: readGitContext(nextProject.path),
		board,
		cards,
	};
	refreshStorageWatcher(store.rootPath);
	return snapshot;
}

function decodeDiscoveredPath(projectId) {
	for (const prefix of ["worktree:", "workspace:"]) {
		if (projectId.startsWith(prefix)) return projectId.slice(prefix.length);
	}
	return null;
}

function activeProjectFromRegistry(registry) {
	const id = registry.activeProjectId;
	if (!id) return null;
	const manual = registry.projects.find((project) => project.id === id);
	if (manual) return manual;
	const discoveredPath = decodeDiscoveredPath(id);
	if (!discoveredPath) return null;
	return {
		id,
		name: projectName(discoveredPath),
		path: discoveredPath,
		storagePath: null,
	};
}

function activeSnapshot() {
	const registry = readRegistry();
	const project = activeProjectFromRegistry(registry);
	if (!project || !fs.existsSync(project.path)) return null;
	return readSnapshotForProject(project, true);
}

function projectStatus(project, registry) {
	if (!fs.existsSync(project.path)) return "missing";
	const resolved = resolveProjectStorage(project, registry, false);
	if (!resolved || !fs.existsSync(boardPath(resolved.rootPath))) return "uninitialized";
	return "ready";
}

function projectEntry(project, registry) {
	return {
		projectId: project.id,
		name: project.name,
		path: project.path,
		storagePath: project.storagePath ?? undefined,
		status: projectStatus(project, registry),
	};
}

function canonicalStorageKey(entry, registry) {
	const project = {
		id: entry.projectId,
		name: entry.name,
		path: entry.path,
		storagePath: entry.storagePath,
	};
	const resolved = resolveProjectStorage(project, registry, false);
	return resolved ? path.resolve(resolved.rootPath) : path.resolve(entry.path);
}

function listWorktrees(registry) {
	const activeProject = activeProjectFromRegistry(registry);
	if (!activeProject) return { source: null, entries: [] };
	const repoRoot = findGitRoot(activeProject.path);
	if (!repoRoot) return { source: null, entries: [] };

	let stdout = "";
	try {
		stdout = execFileSync("git", ["-C", repoRoot, "worktree", "list", "--porcelain"], { encoding: "utf8" });
	} catch {
		return { source: null, entries: [] };
	}

	const entries = stdout
		.split("\n")
		.filter((line) => line.startsWith("worktree "))
		.map((line) => line.slice("worktree ".length).trim())
		.filter(Boolean)
		.map((worktreePath) => {
			const canonical = path.resolve(worktreePath);
			return projectEntry({
				id: `worktree:${canonical}`,
				name: projectName(canonical),
				path: canonical,
				storagePath: null,
			}, registry);
		});

	return {
		source: {
			id: "git_worktrees",
			kind: "gitWorktrees",
			repoRoot,
			label: `Worktrees of ${projectName(repoRoot)}`,
			entries,
		},
		entries,
	};
}

function listWorkspaceFolders(registry) {
	const filePath = registry.activeWorkspaceFile;
	if (!filePath) return { source: null, entries: [] };

	let workspace;
	try {
		workspace = readJson(filePath);
	} catch {
		workspace = { folders: [] };
	}

	const workspaceDir = path.dirname(filePath);
	const entries = (workspace.folders ?? []).map((folder) => {
		const resolved = path.isAbsolute(folder.path) ? folder.path : path.join(workspaceDir, folder.path);
		const canonical = fs.existsSync(resolved) ? fs.realpathSync(resolved) : path.resolve(resolved);
		return projectEntry({
			id: `workspace:${canonical}`,
			name: folder.name ?? projectName(canonical),
			path: canonical,
			storagePath: null,
		}, registry);
	});

	return {
		source: {
			id: "code_workspace",
			kind: "codeWorkspace",
			filePath,
			label: `Workspace: ${projectName(filePath).replace(/\.code-workspace$/, "")}`,
			entries,
		},
		entries,
	};
}

function listView() {
	const registry = readRegistry();
	const seen = new Set();
	const sources = [];

	const manualEntries = registry.projects.map((project) => projectEntry(project, registry));
	const worktrees = listWorktrees(registry);
	const workspace = listWorkspaceFolders(registry);

	for (const source of [
		{ id: "manual", kind: "manual", label: "Projects", entries: manualEntries },
		worktrees.source,
		workspace.source,
	].filter(Boolean)) {
		const entries = [];
		for (const entry of source.entries) {
			const key = canonicalStorageKey(entry, registry);
			if (seen.has(key)) continue;
			seen.add(key);
			entries.push(entry);
		}
		sources.push({ ...source, entries });
	}

	return {
		sources,
		activeProjectId: registry.activeProjectId,
		storageSearchPaths: storageCandidates(registry),
	};
}

function requireActiveProject() {
	const project = activeProjectFromRegistry(readRegistry());
	if (!project) throw new Error("Choose a project first");
	return project;
}

const RANK_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function rankBetween(previous, next) {
	const min = 0;
	const max = RANK_ALPHABET.length - 1;
	const left = previous ?? "";
	const right = next ?? "";
	let prefix = "";
	let index = 0;

	while (true) {
		const leftValue = index < left.length ? RANK_ALPHABET.indexOf(left[index]) : min;
		const rightValue = index < right.length ? RANK_ALPHABET.indexOf(right[index]) : max;
		if (leftValue < 0 || rightValue < 0) throw new Error("Invalid rank");
		if (rightValue - leftValue > 1) {
			const middle = Math.floor((leftValue + rightValue) / 2);
			return `${prefix}${RANK_ALPHABET[middle]}`;
		}
		prefix += index < left.length ? left[index] : RANK_ALPHABET[leftValue];
		index += 1;
	}
}

function activeStore(create) {
	const registry = readRegistry();
	return openStore(requireActiveProject(), registry, create);
}

function createCard(input) {
	const snapshot = activeSnapshot();
	if (!snapshot) throw new Error("Choose a project first");
	const store = activeStore(true);
	const title = String(input.title ?? "").trim();
	if (!title) throw new Error("Card title is required");
	const columnCards = snapshot.cards
		.filter((card) => card.column === input.column)
		.sort((left, right) => left.rank.localeCompare(right.rank));
	const timestamp = now();
	const card = {
		id: newId("card"),
		boardId: DEFAULT_BOARD_ID,
		title,
		description: String(input.description ?? "").trim(),
		parentId: input.parentId ?? null,
		scope: input.scope ? normalizeScope(input.scope) : scopeForGitContext(snapshot.git),
		column: input.column,
		rank: rankBetween(columnCards.at(-1)?.rank ?? null, null),
		labels: [],
		assignee: null,
		fieldValues: {},
		createdAt: timestamp,
		updatedAt: timestamp,
	};
	writeJsonAtomic(cardPath(store.rootPath, card.id), card);
	return card;
}

function applyCardPatch(card, patch) {
	const next = { ...card };
	if (typeof patch.title === "string") next.title = patch.title.trim();
	if (typeof patch.description === "string") next.description = patch.description.trim();
	if ("parentId" in patch) next.parentId = patch.parentId ?? null;
	if (patch.scope) next.scope = normalizeScope(patch.scope);
	if (typeof patch.column === "string") next.column = patch.column;
	if (typeof patch.rank === "string") next.rank = patch.rank;
	if (typeof patch.boardId === "string") next.boardId = patch.boardId;
	if (Array.isArray(patch.labels)) next.labels = patch.labels.filter((label) => typeof label === "string");
	if ("assignee" in patch) next.assignee = typeof patch.assignee === "string" ? patch.assignee : null;
	if (patch.fieldValues && typeof patch.fieldValues === "object") next.fieldValues = patch.fieldValues;
	if (!next.title.trim()) throw new Error("Card title is required");
	next.updatedAt = now();
	return next;
}

function updateCard(cardId, patch) {
	const store = activeStore(false);
	const filePath = cardPath(store.rootPath, cardId);
	const next = applyCardPatch(readJson(filePath), patch ?? {});
	writeJsonAtomic(filePath, next);
	return next;
}

function moveCard(input) {
	const snapshot = activeSnapshot();
	if (!snapshot) throw new Error("Choose a project first");
	const moving = snapshot.cards.find((card) => card.id === input.cardId);
	if (!moving) throw new Error(`Unknown card: ${input.cardId}`);
	const targetCards = snapshot.cards
		.filter((card) => card.id !== input.cardId && card.column === input.toColumn)
		.sort((left, right) => left.rank.localeCompare(right.rank));
	const beforeIndex = input.beforeCardId
		? targetCards.findIndex((card) => card.id === input.beforeCardId)
		: -1;
	const previousRank = beforeIndex > 0
		? targetCards[beforeIndex - 1].rank
		: beforeIndex === 0
			? null
			: targetCards.at(-1)?.rank ?? null;
	const nextRank = beforeIndex >= 0 ? targetCards[beforeIndex].rank : null;
	return updateCard(input.cardId, {
		column: input.toColumn,
		rank: rankBetween(previousRank, nextRank),
	});
}

function refreshStorageWatcher(rootPath) {
	for (const watcher of activeWatchers) watcher.close();
	activeWatchers = [];
	for (const targetPath of [rootPath, boardsPath(rootPath), cardsPath(rootPath)]) {
		if (!fs.existsSync(targetPath)) continue;
		activeWatchers.push(fs.watch(targetPath, () => {
			clearTimeout(watcherTimer);
			watcherTimer = setTimeout(() => {
				mainWindow?.webContents.send("trackboi://project-changed", { rootPath });
			}, 120);
		}));
	}
}

async function chooseDirectory() {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openDirectory"],
	});
	return result.canceled ? null : result.filePaths[0];
}

async function chooseWorkspaceFile() {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openFile"],
		filters: [{ name: "Code Workspace", extensions: ["code-workspace"] }],
	});
	return result.canceled ? null : result.filePaths[0];
}

function registerIpc() {
	ipcMain.handle("trackboi:window-minimize", (event) => {
		BrowserWindow.fromWebContents(event.sender)?.minimize();
	});
	ipcMain.handle("trackboi:window-toggle-maximize", (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return;
		if (window.isMaximized()) window.unmaximize();
		else window.maximize();
	});
	ipcMain.handle("trackboi:window-close", (event) => {
		BrowserWindow.fromWebContents(event.sender)?.close();
	});
	ipcMain.handle("trackboi:window-start-drag", () => {
		// Electron frameless dragging is handled by CSS app regions in the renderer.
	});
	ipcMain.handle("trackboi:window-start-resize", () => {
		// Native edge resize remains available; no JS resize loop needed.
	});
	ipcMain.handle("trackboi:get-active-project", () => activeSnapshot());
	ipcMain.handle("trackboi:list-projects", () => readRegistry());
	ipcMain.handle("trackboi:list-view", () => listView());
	ipcMain.handle("trackboi:set-storage-search-paths", (_event, paths) => {
		const registry = readRegistry();
		registry.storageSearchPaths = normalizeStorageSearchPaths(paths);
		writeRegistry(registry);
		return listView();
	});
	ipcMain.handle("trackboi:set-active-workspace-file", (_event, filePath) => {
		const registry = readRegistry();
		registry.activeWorkspaceFile = filePath || null;
		writeRegistry(registry);
		return listView();
	});
	ipcMain.handle("trackboi:open-workspace-file", async () => {
		const filePath = await chooseWorkspaceFile();
		if (!filePath) return null;
		const registry = readRegistry();
		registry.activeWorkspaceFile = filePath;
		writeRegistry(registry);
		return listView();
	});
	ipcMain.handle("trackboi:choose-project", async () => {
		const selected = await chooseDirectory();
		if (!selected) return activeSnapshot();
		const projectPath = fs.realpathSync(selected);
		const registry = readRegistry();
		const existing = registry.projects.find((project) => project.path === projectPath);
		if (existing) {
			registry.activeProjectId = existing.id;
			writeRegistry(registry);
			return readSnapshotForProject(existing, true);
		}
		const project = {
			id: newId("project"),
			name: projectName(projectPath),
			path: projectPath,
			storagePath: null,
		};
		const resolved = resolveProjectStorage(project, registry, true);
		project.storagePath = resolved?.storagePath ?? null;
		registry.projects.push(project);
		registry.activeProjectId = project.id;
		writeRegistry(registry);
		return readSnapshotForProject(project, true);
	});
	ipcMain.handle("trackboi:locate-project", async (_event, projectId) => {
		const selected = await chooseDirectory();
		if (!selected) return activeSnapshot();
		const projectPath = fs.realpathSync(selected);
		const registry = readRegistry();
		const project = registry.projects.find((entry) => entry.id === projectId);
		if (!project) throw new Error(`Unknown project: ${projectId}`);
		project.path = projectPath;
		project.name = projectName(projectPath);
		project.storagePath = resolveProjectStorage(project, registry, true)?.storagePath ?? null;
		registry.activeProjectId = project.id;
		writeRegistry(registry);
		return readSnapshotForProject(project, true);
	});
	ipcMain.handle("trackboi:remove-project", (_event, projectId) => {
		const registry = readRegistry();
		const previousLength = registry.projects.length;
		registry.projects = registry.projects.filter((project) => project.id !== projectId);
		if (registry.projects.length === previousLength) throw new Error(`Unknown project: ${projectId}`);
		if (registry.activeProjectId === projectId) registry.activeProjectId = registry.projects[0]?.id ?? null;
		writeRegistry(registry);
		return activeSnapshot();
	});
	ipcMain.handle("trackboi:switch-project", (_event, projectId) => {
		const registry = readRegistry();
		const entry = listView().sources.flatMap((source) => source.entries).find((candidate) => candidate.projectId === projectId);
		if (!entry) throw new Error(`Unknown project: ${projectId}`);
		registry.activeProjectId = projectId;
		writeRegistry(registry);
		return activeSnapshot();
	});
	ipcMain.handle("trackboi:create-card", (_event, input) => createCard(input));
	ipcMain.handle("trackboi:update-card", (_event, cardId, patch) => updateCard(cardId, patch));
	ipcMain.handle("trackboi:update-board", (_event, board) => {
		const store = activeStore(false);
		writeJsonAtomic(boardPath(store.rootPath), board);
		return board;
	});
	ipcMain.handle("trackboi:update-custom-fields", (_event, customFields) => {
		const store = activeStore(false);
		const filePath = projectMetadataPath(store.rootPath);
		const metadata = { ...readJson(filePath), customFields };
		writeJsonAtomic(filePath, metadata);
		return metadata;
	});
	ipcMain.handle("trackboi:move-card", (_event, input) => moveCard(input));
	ipcMain.handle("trackboi:delete-card", (_event, cardId) => {
		const store = activeStore(false);
		fs.rmSync(cardPath(store.rootPath, cardId), { force: true });
		return { ok: true };
	});
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1180,
		height: 760,
		minWidth: 760,
		minHeight: 480,
		frame: false,
		title: "Trackboi",
		backgroundColor: "#090909",
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	if (process.env.TRACKBOI_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.TRACKBOI_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
	}
}

app.setName("Trackboi");
app.whenReady().then(() => {
	registerIpc();
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
