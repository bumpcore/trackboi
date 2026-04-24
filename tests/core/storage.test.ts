import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { STORAGE_SEARCH_PATHS } from "../../src/core/constants";
import { writeJsonAtomic } from "../../src/core/json";
import { sanitizeRegistry } from "../../src/core/registry";
import { projectEntry } from "../../src/core/sources";
import { resolveProjectStorage } from "../../src/core/storage";
import type { Board, Project, ProjectMetadata, ProjectRegistry } from "../../src/core/types";

const createdRoots: string[] = [];

afterEach(() => {
	for (const root of createdRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("storage path preference", () => {
	test("configured search order wins over a remembered project storage path", () => {
		const project = createProject();
		writeStore(project.path, ".trackboi", "Root board");
		writeStore(project.path, ".etc/.trackboi", "Etc board");

		const resolved = resolveProjectStorage({
			...project,
			storagePath: ".etc/.trackboi",
		}, registry(), false);

		expect(resolved?.storagePath).toBe(".trackboi");
	});

	test("new storage is created under .etc when the directory already exists", () => {
		const project = createProject();
		mkdirSync(path.join(project.path, ".etc"), { recursive: true });

		const resolved = resolveProjectStorage(project, registry(), true);

		expect(resolved?.storagePath).toBe(".etc/.trackboi");
	});

	test("new storage defaults to .trackboi when .etc does not exist", () => {
		const project = createProject();

		const resolved = resolveProjectStorage(project, registry(), true);

		expect(resolved?.storagePath).toBe(".trackboi");
	});

	test("legacy etc-first registry defaults are migrated to the current default order", () => {
		const sanitized = sanitizeRegistry({
			storageSearchPaths: [".etc/.trackboi", ".etc/trackboi", ".trackboi"],
		});

		expect(sanitized.storageSearchPaths).toEqual([...STORAGE_SEARCH_PATHS]);
	});

	test("project entries report the effective resolved storage path", () => {
		const project = createProject();
		writeStore(project.path, ".trackboi", "Root board");
		writeStore(project.path, ".etc/.trackboi", "Etc board");

		const entry = projectEntry({
			...project,
			storagePath: ".etc/.trackboi",
		}, registry());

		expect(entry.storagePath).toBe(".trackboi");
		expect(entry.cardCount).toBe(0);
	});
});

function createProject(): Project {
	const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-storage-"));
	createdRoots.push(root);
	return {
		name: "repo",
		path: root,
		storagePath: undefined,
	};
}

function registry(): ProjectRegistry {
	return {
		projects: [],
		activeProjectPath: null,
		selectedWorktreeId: null,
		selectedBoardId: null,
		activeWorkspaceFile: null,
		storageSearchPaths: [...STORAGE_SEARCH_PATHS],
		appSettings: {
			people: [],
			agents: [],
			editor: { preferredEditorId: "auto", customCommand: "" },
		},
	};
}

function writeStore(projectPath: string, storagePath: string, boardName: string): void {
	const root = path.join(projectPath, storagePath);
	writeJsonAtomic<ProjectMetadata>(path.join(root, "project.json"), {
		version: 1,
		name: boardName,
		people: [],
		agents: [],
	});
	writeJsonAtomic<Board>(path.join(root, "boards/default.json"), {
		id: "default",
		version: 1,
		name: boardName,
		columns: [{ id: "todo", name: "To Do" }],
		customFields: [],
	});
}
