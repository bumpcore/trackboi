import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { STORAGE_SEARCH_PATHS } from "../../src/core/constants";
import { writeJsonAtomic } from "../../src/core/json";
import {
	createRegistryStore,
	defaultAppSettings,
	defaultEditorPreference,
	defaultOnboardingState,
	defaultUserIdentity,
	sanitizeRegistry,
} from "../../src/core/registry";
import type { ProjectRegistry } from "../../src/core/types";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("registry settings defaults", () => {
	test("default app settings include empty identity and onboarding state", () => {
		expect(defaultAppSettings()).toEqual({
			version: 1,
			agents: [],
			agentContexts: [],
			editor: defaultEditorPreference(),
			userIdentity: defaultUserIdentity(),
			onboarding: defaultOnboardingState(),
			shortcuts: {
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
			},
		});
	});

	test("sanitizeRegistry fills missing registry fields", () => {
		const registry = sanitizeRegistry({});
		expect(registry.projects).toEqual([]);
		expect(registry.activeProjectPath).toBeNull();
		expect(registry.selectedWorktreeId).toBeNull();
		expect(registry.selectedBoardId).toBeNull();
		expect(registry.activeWorkspaceFile).toBeNull();
		expect(registry.storageSearchPaths).toEqual([...STORAGE_SEARCH_PATHS]);
	});

	test("sanitizeRegistry trims user identity fields", () => {
		const registry = sanitizeRegistry({
			appSettings: {
				userIdentity: {
					displayName: "  Ada  ",
					gitName: "  Ada Lovelace  ",
					gitEmail: "  ada@example.test  ",
				},
			},
		});
		expect(registry.appSettings.userIdentity).toEqual({
			displayName: "Ada",
			gitName: "Ada Lovelace",
			gitEmail: "ada@example.test",
		});
	});

	test("sanitizeRegistry rejects malformed user identity values", () => {
		const registry = sanitizeRegistry({
			appSettings: {
				userIdentity: {
					displayName: 123,
					gitName: null,
					gitEmail: [],
				} as never,
			},
		});
		expect(registry.appSettings.userIdentity).toEqual(defaultUserIdentity());
	});

	test("sanitizeRegistry preserves explicit onboarding completion flags", () => {
		const registry = sanitizeRegistry({
			appSettings: {
				onboarding: {
					userComplete: true,
					firstProjectComplete: true,
				},
			},
		});
		expect(registry.appSettings.onboarding).toEqual({ userComplete: true, firstProjectComplete: true });
	});

	test("sanitizeRegistry defaults malformed onboarding completion flags", () => {
		const registry = sanitizeRegistry({
			appSettings: {
				onboarding: {
					userComplete: "yes",
					firstProjectComplete: 1,
				} as never,
			},
		});
		expect(registry.appSettings.onboarding).toEqual({ userComplete: false, firstProjectComplete: false });
	});

	const shortcutCases = [
		["leftPanel", "Alt+B"],
		["rightPanel", "Alt+Shift+X"],
		["commandCenterNavigate", "Meta+P"],
		["commandCenterCommand", "Meta+Shift+P"],
		["openSettings", "Meta+,"],
		["addProject", "Meta+O"],
		["newCard", "Meta+N"],
		["newTrack", "Meta+Shift+N"],
		["nextProject", "Meta+PageDown"],
		["previousProject", "Meta+PageUp"],
		["projectSettings", "Meta+Alt+,"],
		["boardSettings", "Meta+Alt+B"],
		["focusBoard", "Meta+Alt+0"],
	] as const;

	for (const [key, value] of shortcutCases) {
		test(`sanitizeRegistry preserves configured shortcut ${key}`, () => {
			const registry = sanitizeRegistry({
				appSettings: {
					shortcuts: { [key]: value },
				},
			});
			expect(registry.appSettings.shortcuts[key]).toBe(value);
		});
	}

	test("sanitizeRegistry falls back for empty shortcut strings", () => {
		const registry = sanitizeRegistry({
			appSettings: {
				shortcuts: {
					leftPanel: "",
					openSettings: "   ",
				},
			},
		});
		expect(registry.appSettings.shortcuts.leftPanel).toBe("Ctrl+B");
		expect(registry.appSettings.shortcuts.openSettings).toBe("Ctrl+,");
	});

	test("sanitizeRegistry filters invalid agent registrations", () => {
		const registry = sanitizeRegistry({
			appSettings: {
				agents: [
					{ id: "agent_codex", name: "Codex", description: "Local agent" },
					{ id: "broken", name: "No description" },
					null,
				] as never,
			},
		});
		expect(registry.appSettings.agents).toEqual([
			{ id: "agent_codex", name: "Codex", description: "Local agent" },
		]);
	});

	test("sanitizeRegistry filters invalid agent contexts", () => {
		const registry = sanitizeRegistry({
			appSettings: {
				agentContexts: [
					{ agentId: "agent_codex", projectPath: "/repo", boardId: "default" },
					{ agentId: "agent_codex", projectPath: "/repo", boardId: 123 },
					{ agentId: "agent_codex_2", projectPath: "/repo", boardId: null },
					{ boardId: null, activeAgentId: null },
				] as never,
			},
		});
		expect(registry.appSettings.agentContexts).toEqual([
			{ agentId: "agent_codex", projectPath: "/repo", boardId: "default" },
			{ agentId: "agent_codex_2", projectPath: "/repo", boardId: null },
		]);
	});
});

describe("registry store", () => {
	test("readRegistry returns defaults when config file is missing", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-registry-"));
		roots.push(root);
		const store = createRegistryStore({ configPath: path.join(root, "config.json") });

		expect(store.readRegistry().projects).toEqual([]);
		expect(store.readRegistry().appSettings.userIdentity).toEqual(defaultUserIdentity());
	});

	test("writeRegistry creates parent directories and persists sanitized data", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-registry-"));
		roots.push(root);
		const configPath = path.join(root, "nested/config.json");
		const store = createRegistryStore({ configPath });

		store.writeRegistry(sanitizeRegistry({
			projects: [{ name: "Repo", path: "/tmp/repo" }],
			activeProjectPath: "/tmp/repo",
			appSettings: {
				userIdentity: { displayName: " Ada ", gitName: " Ada ", gitEmail: " ada@example.test " },
			},
		}));

		expect(existsSync(configPath)).toBe(true);
		expect(store.readRegistry().projects).toEqual([{ name: "Repo", path: "/tmp/repo" }]);
		expect(store.readRegistry().appSettings.userIdentity.displayName).toBe("Ada");
	});

	test("readRegistry sanitizes malformed persisted files", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-registry-"));
		roots.push(root);
		const configPath = path.join(root, "config.json");
		mkdirSync(root, { recursive: true });
		writeJsonAtomic<Partial<ProjectRegistry>>(configPath, {
			projects: [{ name: 123, path: "" } as never, { name: "Ok", path: "/tmp/ok" }],
			storageSearchPaths: [".trackboi", ".trackboi"],
			appSettings: { editor: { preferredEditorId: "", customCommand: 12 as never } },
		});

		const store = createRegistryStore({ configPath });
		const registry = store.readRegistry();
		expect(registry.projects).toEqual([{ name: "Ok", path: "/tmp/ok" }]);
		expect(registry.storageSearchPaths).toEqual([".trackboi"]);
		expect(registry.appSettings.editor).toEqual({ preferredEditorId: "auto", customCommand: "" });
	});
});
