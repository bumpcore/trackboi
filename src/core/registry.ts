import os from "node:os";
import path from "node:path";
import { STORAGE_SEARCH_PATHS } from "./constants";
import { readJson, writeJsonAtomic } from "./json";
import type { Project, ProjectRegistry } from "./types";

export type RegistryOptions = {
	configPath?: string;
	legacyConfigPaths?: string[];
};

export type RegistryStore = {
	configPath: string;
	legacyConfigPaths: string[];
	readRegistry(): ProjectRegistry;
	writeRegistry(registry: ProjectRegistry): ProjectRegistry;
};

export function defaultConfigDir(): string {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Trackboi");
	if (process.platform === "win32") {
		return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Trackboi");
	}
	if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, "Trackboi");
	return path.join(os.homedir(), ".config", "Trackboi");
}

/**
 * Creates a small registry store for app-level Trackboi configuration.
 *
 * The registry is intentionally outside repo storage because it remembers which
 * local projects the desktop app/CLI knows about on this machine.
 */
export function createRegistryStore(options: RegistryOptions = {}): RegistryStore {
	const configPath = options.configPath ?? path.join(defaultConfigDir(), "config.json");
	const legacyConfigPaths = options.legacyConfigPaths ?? [
		path.join(os.homedir(), ".config", "dev.bumpcore.trackboi", "config.json"),
		path.join(os.homedir(), ".config", "trackboi", "config.json"),
	];

	function readRegistry(): ProjectRegistry {
		for (const candidatePath of [configPath, ...legacyConfigPaths]) {
			try {
				const registry = sanitizeRegistry(readJson<ProjectRegistry>(candidatePath));
				if (candidatePath !== configPath) writeJsonAtomic(configPath, registry);
				return registry;
			} catch {
				// Try the next known registry location.
			}
		}

		return defaultRegistry();
	}

	function writeRegistry(registry: ProjectRegistry): ProjectRegistry {
		const nextRegistry = sanitizeRegistry(registry);
		writeJsonAtomic(configPath, nextRegistry);
		return nextRegistry;
	}

	return { configPath, legacyConfigPaths, readRegistry, writeRegistry };
}

export function defaultRegistry(): ProjectRegistry {
	return {
		projects: [],
		activeProjectId: null,
		storageSearchPaths: [...STORAGE_SEARCH_PATHS],
		activeWorkspaceFile: null,
		selectedWorktreeId: null,
	};
}

/**
 * Normalizes repo-relative storage lookup paths.
 *
 * Absolute paths and parent traversal are rejected so storage roots always stay
 * inside the selected project folder.
 */
export function normalizeStorageSearchPaths(paths: readonly string[]): string[] {
	const normalized: string[] = [];
	for (const rawPath of paths) {
		const nextPath = rawPath.trim().replaceAll("\\", "/").replace(/^\.\//, "");
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

export function sanitizeRegistry(registry: Partial<ProjectRegistry>): ProjectRegistry {
	const storageSearchPaths = Array.isArray(registry.storageSearchPaths)
		? normalizeStorageSearchPaths(registry.storageSearchPaths)
		: [...STORAGE_SEARCH_PATHS];
	const projects = Array.isArray(registry.projects)
		? registry.projects.filter(isValidProject)
		: [];

	return {
		projects,
		activeProjectId: registry.activeProjectId ?? projects[0]?.id ?? null,
		storageSearchPaths,
		activeWorkspaceFile: typeof registry.activeWorkspaceFile === "string" ? registry.activeWorkspaceFile : null,
		selectedWorktreeId: typeof registry.selectedWorktreeId === "string" ? registry.selectedWorktreeId : null,
	};
}

function isValidProject(project: unknown): project is Project {
	if (typeof project !== "object" || project === null) return false;
	if (!("id" in project) || !("name" in project) || !("path" in project)) return false;
	return typeof project.id === "string" &&
		typeof project.name === "string" &&
		typeof project.path === "string" &&
		(!("storagePath" in project) || project.storagePath === undefined || typeof project.storagePath === "string");
}
