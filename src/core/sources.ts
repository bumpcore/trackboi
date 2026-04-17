import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { findGitRoot, listGitWorktreePaths } from "./git";
import { readJson } from "./json";
import { boardPath } from "./paths";
import { projectName, resolveProjectStorage } from "./storage";
import type { Project, ProjectEntry, ProjectRegistry, ProjectSource } from "./types";

type CodeWorkspaceFile = {
	folders?: Array<{
		path: string;
		name?: string;
	}>;
};

export function decodeDiscoveredPath(projectId: string): string | null {
	for (const prefix of ["worktree:", "workspace:"]) {
		if (projectId.startsWith(prefix)) return projectId.slice(prefix.length);
	}
	return null;
}

export function activeProjectFromRegistry(registry: ProjectRegistry): Project | null {
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
		storagePath: undefined,
	};
}

export function projectStatus(project: Project, registry: ProjectRegistry): ProjectEntry["status"] {
	if (!existsSync(project.path)) return "missing";
	const resolved = resolveProjectStorage(project, registry, false);
	if (!resolved || !existsSync(boardPath(resolved.rootPath))) return "uninitialized";
	return "ready";
}

export function projectEntry(project: Project, registry: ProjectRegistry): ProjectEntry {
	return {
		projectId: project.id,
		name: project.name,
		path: project.path,
		storagePath: project.storagePath,
		status: projectStatus(project, registry),
	};
}

export function canonicalStorageKey(entry: ProjectEntry, registry: ProjectRegistry): string {
	const project: Project = {
		id: entry.projectId,
		name: entry.name,
		path: entry.path,
		storagePath: entry.storagePath,
	};
	const resolved = resolveProjectStorage(project, registry, false);
	return resolved ? path.resolve(resolved.rootPath) : path.resolve(entry.path);
}

export function listWorktreeSource(registry: ProjectRegistry): ProjectSource | null {
	const activeProject = activeProjectFromRegistry(registry);
	if (!activeProject) return null;
	const repoRoot = findGitRoot(activeProject.path);
	if (!repoRoot) return null;

	const entries = listGitWorktreePaths(repoRoot).map((worktreePath) => {
		const canonical = path.resolve(worktreePath);
		return projectEntry({
			id: `worktree:${canonical}`,
			name: projectName(canonical),
			path: canonical,
			storagePath: undefined,
		}, registry);
	});

	return {
		id: "git_worktrees",
		kind: "gitWorktrees",
		repoRoot,
		label: `Worktrees of ${projectName(repoRoot)}`,
		entries,
	};
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
	const entries = (workspace.folders ?? []).map((folder) => {
		const resolved = path.isAbsolute(folder.path) ? folder.path : path.join(workspaceDir, folder.path);
		const canonical = existsSync(resolved) ? realpathSync(resolved) : path.resolve(resolved);
		return projectEntry({
			id: `workspace:${canonical}`,
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
