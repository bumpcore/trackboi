import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { mkdir, readFile, rename } from "node:fs/promises";
import type { Project, ProjectRegistry } from "../../shared/types";

const CONFIG_DIR_NAME = "trackboi";
const CONFIG_FILE_NAME = "config.json";

function configRoot() {
	switch (process.platform) {
		case "darwin":
			return join(homedir(), "Library", "Application Support", CONFIG_DIR_NAME);
		case "win32":
			return join(process.env.APPDATA ?? homedir(), CONFIG_DIR_NAME);
		default:
			return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), CONFIG_DIR_NAME);
	}
}

function configPath() {
	return join(configRoot(), CONFIG_FILE_NAME);
}

async function atomicWriteJson(path: string, value: unknown) {
	const tempPath = `${path}.tmp`;
	await Bun.write(tempPath, `${JSON.stringify(value, null, "\t")}\n`);
	await rename(tempPath, path);
}

function asRegistry(value: unknown): ProjectRegistry {
	if (typeof value !== "object" || value == null) {
		return { projects: [], activeProjectId: null };
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
		: [];

	const activeProjectId = typeof registry.activeProjectId === "string"
		? registry.activeProjectId
		: null;

	return {
		projects,
		activeProjectId: projects.some((project) => project.id === activeProjectId)
			? activeProjectId
			: projects[0]?.id ?? null,
	};
}

export async function readRegistry(): Promise<ProjectRegistry> {
	try {
		return asRegistry(JSON.parse(await readFile(configPath(), "utf8")) as unknown);
	} catch {
		return { projects: [], activeProjectId: null };
	}
}

export async function writeRegistry(registry: ProjectRegistry) {
	await mkdir(configRoot(), { recursive: true });
	await atomicWriteJson(configPath(), registry);
	return registry;
}

export async function addProjectToRegistry(projectPath: string, name?: string) {
	const resolvedPath = resolve(projectPath);
	const registry = await readRegistry();
	const existingProject = registry.projects.find((project) => project.path === resolvedPath);

	if (existingProject) {
		registry.activeProjectId = existingProject.id;
		await writeRegistry(registry);
		return { registry, project: existingProject };
	}

	const project: Project = {
		id: `project_${crypto.randomUUID()}`,
		name: name ?? basename(resolvedPath),
		path: resolvedPath,
	};

	registry.projects.push(project);
	registry.activeProjectId = project.id;
	await writeRegistry(registry);
	return { registry, project };
}

export async function setActiveProject(projectId: string) {
	const registry = await readRegistry();
	if (!registry.projects.some((project) => project.id === projectId)) {
		throw new Error(`Unknown project: ${projectId}`);
	}

	registry.activeProjectId = projectId;
	await writeRegistry(registry);
	return registry;
}

export function activeProjectFromRegistry(registry: ProjectRegistry) {
	return registry.projects.find((project) => project.id === registry.activeProjectId) ?? null;
}

export async function ensureInitialProject(projectPath: string | null) {
	const registry = await readRegistry();
	if (registry.projects.length > 0 || projectPath == null) {
		return registry;
	}

	return (await addProjectToRegistry(projectPath)).registry;
}
