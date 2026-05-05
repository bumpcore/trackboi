import os from "node:os";
import path from "node:path";
import { STORAGE_SEARCH_PATHS } from "./constants";
import { existsSync } from "node:fs";
import { readJson, writeJsonAtomic } from "./json";
import type { AgentContext, AgentRegistration, AppSettings, AppShortcuts, EditorPreference, OnboardingState, Project, ProjectRegistry, UserIdentity } from "./types";

const LEGACY_ETC_FIRST_STORAGE_SEARCH_PATHS = [".etc/.trackboi", ".etc/trackboi", ".trackboi"];

export type RegistryOptions = {
	configPath?: string;
};

export type RegistryStore = {
	configPath: string;
	readRegistry(): ProjectRegistry;
	writeRegistry(registry: ProjectRegistry): ProjectRegistry;
};

export function defaultConfigDir(): string {
	return path.join(os.homedir(), ".trackboi");
}

export function legacyConfigDir(): string {
	if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "trackboi");
	if (process.platform === "win32") {
		return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "trackboi");
	}
	if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, "trackboi");
	return path.join(os.homedir(), ".config", "trackboi");
}

/**
 * Creates a small registry store for app-level Trackboi configuration.
 *
 * The registry is intentionally outside repo storage because it remembers which
 * local projects the desktop app/CLI knows about on this machine.
 */
export function createRegistryStore(options: RegistryOptions = {}): RegistryStore {
	const configPath = options.configPath ?? path.join(defaultConfigDir(), "config.json");
	const fallbackConfigPath = options.configPath ? null : path.join(legacyConfigDir(), "config.json");

	function readRegistry(): ProjectRegistry {
		try {
			return sanitizeRegistry(readJson<ProjectRegistry>(configPath));
		} catch {
			if (fallbackConfigPath && fallbackConfigPath !== configPath && existsSync(fallbackConfigPath)) {
				try {
					return sanitizeRegistry(readJson<ProjectRegistry>(fallbackConfigPath));
				} catch {
					return defaultRegistry();
				}
			}
			return defaultRegistry();
		}
	}

	function writeRegistry(registry: ProjectRegistry): ProjectRegistry {
		const nextRegistry = sanitizeRegistry(registry);
		writeJsonAtomic(configPath, nextRegistry);
		return nextRegistry;
	}

	return { configPath, readRegistry, writeRegistry };
}

export function defaultRegistry(): ProjectRegistry {
	return {
		projects: [],
		activeProjectPath: null,
		storageSearchPaths: [...STORAGE_SEARCH_PATHS],
		activeWorkspaceFile: null,
		selectedWorktreeId: null,
		selectedBoardId: null,
		appSettings: defaultAppSettings(),
	};
}

export function defaultAppSettings(): AppSettings {
	return {
		version: 1,
		agents: [],
		agentContexts: [],
		editor: defaultEditorPreference(),
		userIdentity: defaultUserIdentity(),
		onboarding: defaultOnboardingState(),
		shortcuts: defaultAppShortcuts(),
	};
}

export function defaultEditorPreference(): EditorPreference {
	return {
		preferredEditorId: "auto",
		customCommand: "",
	};
}

export function defaultUserIdentity(): UserIdentity {
	return {
		displayName: "",
		gitName: "",
		gitEmail: "",
	};
}

export function defaultOnboardingState(): OnboardingState {
	return {
		userComplete: false,
		firstProjectComplete: false,
	};
}

export function defaultAppShortcuts(): AppShortcuts {
	return {
		leftPanel: "Ctrl+B",
		rightPanel: "Ctrl+Shift+X",
		commandCenterNavigate: "Ctrl+P",
		commandCenterCommand: "Ctrl+Shift+P",
		openSettings: "Ctrl+,",
		addProject: "Ctrl+O",
		newCard: "Ctrl+N",
		newTrack: "Ctrl+Shift+N",
		nextProject: "Ctrl+PageDown",
		previousProject: "Ctrl+PageUp",
		projectSettings: "Ctrl+Alt+,",
		boardSettings: "Ctrl+Alt+B",
		focusBoard: "Ctrl+Alt+0",
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
		? normalizeRegistryStorageSearchPaths(registry.storageSearchPaths)
		: [...STORAGE_SEARCH_PATHS];
	const projects = Array.isArray(registry.projects)
		? registry.projects.filter(isValidProject)
		: [];

	return {
		projects,
		activeProjectPath: registry.activeProjectPath ?? projects[0]?.path ?? null,
		storageSearchPaths,
		activeWorkspaceFile: typeof registry.activeWorkspaceFile === "string" ? registry.activeWorkspaceFile : null,
		selectedWorktreeId: typeof registry.selectedWorktreeId === "string" ? registry.selectedWorktreeId : null,
		selectedBoardId: typeof registry.selectedBoardId === "string" ? registry.selectedBoardId : null,
		appSettings: sanitizeAppSettings(registry.appSettings),
	};
}

function normalizeRegistryStorageSearchPaths(paths: readonly string[]): string[] {
	const normalized = normalizeStorageSearchPaths(paths);
	return arraysEqual(normalized, LEGACY_ETC_FIRST_STORAGE_SEARCH_PATHS)
		? [...STORAGE_SEARCH_PATHS]
		: normalized;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sanitizeAppSettings(value: Partial<AppSettings> | undefined): AppSettings {
	return {
		version: 1,
		agents: Array.isArray(value?.agents) ? value.agents.filter(isValidAgentRegistration) : [],
		agentContexts: Array.isArray(value?.agentContexts) ? value.agentContexts.filter(isValidAgentContext) : [],
		editor: sanitizeEditorPreference(value?.editor),
		userIdentity: sanitizeUserIdentity(value?.userIdentity),
		onboarding: sanitizeOnboardingState(value?.onboarding),
		shortcuts: sanitizeAppShortcuts(value?.shortcuts),
	};
}

function sanitizeEditorPreference(value: Partial<EditorPreference> | undefined): EditorPreference {
	return {
		preferredEditorId: typeof value?.preferredEditorId === "string" && value.preferredEditorId.trim()
			? value.preferredEditorId.trim()
			: "auto",
		customCommand: typeof value?.customCommand === "string" ? value.customCommand : "",
	};
}

function sanitizeUserIdentity(value: Partial<UserIdentity> | undefined): UserIdentity {
	return {
		displayName: typeof value?.displayName === "string" ? value.displayName.trim() : "",
		gitName: typeof value?.gitName === "string" ? value.gitName.trim() : "",
		gitEmail: typeof value?.gitEmail === "string" ? value.gitEmail.trim() : "",
	};
}

function sanitizeOnboardingState(value: Partial<OnboardingState> | undefined): OnboardingState {
	return {
		userComplete: typeof value?.userComplete === "boolean" ? value.userComplete : false,
		firstProjectComplete: typeof value?.firstProjectComplete === "boolean" ? value.firstProjectComplete : false,
	};
}

function sanitizeAppShortcuts(value: Partial<AppShortcuts> | undefined): AppShortcuts {
	const defaults = defaultAppShortcuts();
	return {
		leftPanel: sanitizeShortcutValue(value?.leftPanel, defaults.leftPanel),
		rightPanel: sanitizeShortcutValue(value?.rightPanel, defaults.rightPanel),
		commandCenterNavigate: sanitizeShortcutValue(value?.commandCenterNavigate, defaults.commandCenterNavigate),
		commandCenterCommand: sanitizeShortcutValue(value?.commandCenterCommand, defaults.commandCenterCommand),
		openSettings: sanitizeShortcutValue(value?.openSettings, defaults.openSettings),
		addProject: sanitizeShortcutValue(value?.addProject, defaults.addProject),
		newCard: sanitizeShortcutValue(value?.newCard, defaults.newCard),
		newTrack: sanitizeShortcutValue(value?.newTrack, defaults.newTrack),
		nextProject: sanitizeShortcutValue(value?.nextProject, defaults.nextProject),
		previousProject: sanitizeShortcutValue(value?.previousProject, defaults.previousProject),
		projectSettings: sanitizeShortcutValue(value?.projectSettings, defaults.projectSettings),
		boardSettings: sanitizeShortcutValue(value?.boardSettings, defaults.boardSettings),
		focusBoard: sanitizeShortcutValue(value?.focusBoard, defaults.focusBoard),
	};
}

function sanitizeShortcutValue(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isValidAgentRegistration(agent: unknown): agent is AgentRegistration {
	if (typeof agent !== "object" || agent === null) return false;
	if (!("id" in agent) || !("name" in agent) || !("description" in agent)) return false;
	return typeof agent.id === "string" &&
		typeof agent.name === "string" &&
		typeof agent.description === "string";
}

function isValidAgentContext(context: unknown): context is AgentContext {
	if (typeof context !== "object" || context === null) return false;
	if (!("agentId" in context)) return false;
	return typeof context.agentId === "string" &&
		(!("projectPath" in context) || context.projectPath === null || typeof context.projectPath === "string") &&
		(!("worktreeId" in context) || context.worktreeId === null || typeof context.worktreeId === "string") &&
		(!("boardId" in context) || context.boardId === null || typeof context.boardId === "string");
}

function isValidProject(project: unknown): project is Project {
	if (typeof project !== "object" || project === null) return false;
	if (!("name" in project) || !("path" in project)) return false;
	return typeof project.name === "string" &&
		typeof project.path === "string" &&
		(!("storagePath" in project) || project.storagePath === undefined || typeof project.storagePath === "string");
}
