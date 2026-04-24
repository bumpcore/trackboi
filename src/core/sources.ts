import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { readGitContext } from "./git";
import { readJson } from "./json";
import { countCards, hasBoards, projectName, resolveProjectStorage } from "./storage";
import type { Project, ProjectEntry, ProjectRegistry, ProjectSource } from "./types";

type CodeWorkspaceFile = {
	folders?: Array<{
		path?: string;
		name?: string;
	}>;
};

export function activeProjectFromRegistry(registry: ProjectRegistry): Project | null {
	const projectPath = registry.activeProjectPath;
	if (!projectPath) return null;
	const manual = registry.projects.find((project) => project.path === projectPath);
	if (manual) return manual;
	return {
		name: projectName(projectPath),
		path: projectPath,
		storagePath: undefined,
	};
}

export function projectStatus(project: Project, registry: ProjectRegistry): ProjectEntry["status"] {
	if (!existsSync(project.path)) return "missing";
	const resolved = resolveProjectStorage(project, registry, false);
	if (!resolved || !hasBoards(resolved.rootPath)) return "uninitialized";
	return "ready";
}

function projectCardCount(project: Project, registry: ProjectRegistry): number | null {
	const resolved = resolveProjectStorage(project, registry, false);
	if (!resolved || !hasBoards(resolved.rootPath)) return null;
	return countCards(resolved.rootPath);
}

export function projectEntry(project: Project, registry: ProjectRegistry): ProjectEntry {
	const git = readGitContext(project.path);
	const resolved = resolveProjectStorage(project, registry, false);
	return {
		projectPath: project.path,
		name: project.name,
		path: project.path,
		storagePath: resolved?.storagePath ?? project.storagePath,
		status: projectStatus(project, registry),
		branch: git.branch,
		cardCount: resolved && hasBoards(resolved.rootPath) ? countCards(resolved.rootPath) : null,
	};
}

export function canonicalStorageKey(entry: ProjectEntry, registry: ProjectRegistry): string {
	const project: Project = {
		name: entry.name,
		path: entry.path,
		storagePath: entry.storagePath,
	};
	const resolved = resolveProjectStorage(project, registry, false);
	return resolved ? path.resolve(resolved.rootPath) : path.resolve(entry.path);
}

export function listWorkspaceSource(registry: ProjectRegistry): ProjectSource | null {
	const filePath = registry.activeWorkspaceFile;
	if (!filePath) return null;

	let workspace: CodeWorkspaceFile;
	try {
		workspace = readJson<CodeWorkspaceFile>(filePath);
	} catch {
		workspace = { folders: [] };
	}

	const workspaceDir = path.dirname(filePath);
	const entries = (workspace.folders ?? [])
		.filter((folder) => typeof folder.path === "string" && folder.path.trim().length > 0)
		.map((folder) => {
			const folderPath = folder.path ?? "";
			const resolved = path.isAbsolute(folderPath) ? folderPath : path.join(workspaceDir, folderPath);
			const canonical = existsSync(resolved) ? realpathSync(resolved) : path.resolve(resolved);
			return projectEntry({
				name: folder.name ?? projectName(canonical),
				path: canonical,
				storagePath: undefined,
			}, registry);
		});

	return {
		id: "code_workspace",
		kind: "codeWorkspace",
		filePath,
		label: `Workspace: ${projectName(filePath).replace(/\.code-workspace$/, "")}`,
		entries,
	};
}
