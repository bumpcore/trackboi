import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { shell } from "electron";
import type { NodeFsTrackboiActions } from "../../core";
import type { DetectedEditor } from "../bridge";

const KNOWN_EDITORS: DetectedEditor[] = [
	{ id: "code", label: "Visual Studio Code", command: "code" },
	{ id: "cursor", label: "Cursor", command: "cursor" },
	{ id: "codium", label: "VSCodium", command: "codium" },
	{ id: "zed", label: "Zed", command: "zed" },
	{ id: "subl", label: "Sublime Text", command: "subl" },
	{ id: "nvim", label: "Neovim", command: "nvim" },
	{ id: "vim", label: "Vim", command: "vim" },
];

/**
 * Detects common local editors so Trackboi can offer useful choices without
 * forcing the user to manually type a command first.
 */
export function listDetectedEditors(): DetectedEditor[] {
	return KNOWN_EDITORS.filter((editor) => commandExists(editor.command));
}

export async function openCardInEditor(trackboi: NodeFsTrackboiActions, cardId: string): Promise<{ ok: true }> {
	const snapshot = trackboi.activeSnapshot();
	const card = snapshot?.cards.find((candidate) => candidate.id === cardId);
	if (!card?.originWorktreeId) throw new Error(`Unknown card: ${cardId}`);

	const registry = trackboi.readRegistry();
	const project = registry.projects.find((candidate) => candidate.id === registry.activeProjectId);
	if (!project) throw new Error("Choose a project first");
	const worktree = (trackboi.runtime.readDesktopState().worktrees ?? []).find((candidate) => candidate.id === card.originWorktreeId);
	if (!worktree?.storageRoot) throw new Error(`Unknown card origin for ${cardId}`);

	const filePath = trackboi.paths.cardPath(worktree.storageRoot, cardId);
	if (!existsSync(filePath)) throw new Error(`Card file is missing for ${cardId}`);

	const settings = registry.appSettings;
	await openPathWithEditorPreference(filePath, settings.editor.preferredEditorId, settings.editor.customCommand);
	return { ok: true };
}

export async function openPathWithEditorPreference(
	filePath: string,
	preferredEditorId: string,
	customCommand: string,
): Promise<void> {
	if (preferredEditorId === "custom" && customCommand.trim()) {
		spawnCustomCommand(customCommand, filePath);
		return;
	}

	if (preferredEditorId !== "auto") {
		const editor = KNOWN_EDITORS.find((candidate) => candidate.id === preferredEditorId);
		if (editor && commandExists(editor.command)) {
			spawnDetached(editor.command, [filePath]);
			return;
		}
	}

	const detected = listDetectedEditors()[0];
	if (detected) {
		spawnDetached(detected.command, [filePath]);
		return;
	}

	await shell.openPath(filePath);
}

function commandExists(command: string): boolean {
	try {
		execFileSync("which", [command], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function spawnDetached(command: string, args: string[]): void {
	const child = spawn(command, args, {
		detached: true,
		stdio: "ignore",
	});
	child.unref();
}

function spawnCustomCommand(command: string, filePath: string): void {
	const interpolated = command.includes("{path}")
		? command.replaceAll("{path}", JSON.stringify(filePath))
		: `${command} ${JSON.stringify(filePath)}`;
	const child = spawn("/bin/sh", ["-lc", interpolated], {
		detached: true,
		stdio: "ignore",
	});
	child.unref();
}
