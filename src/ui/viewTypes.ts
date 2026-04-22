import type { FieldValue } from "@/core/types";

export type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

export type BoardScopeMode = "all" | "global";

export type ScopeMode = "track" | "global" | "existing";

export type LeftPanelView = "explorer";

export type RightPanelView = "card" | "track" | "activity" | "context" | "column";

export type WorkspaceShellPrefs = {
	leftWidth: number;
	rightWidth: number;
	leftCollapsed: boolean;
	rightCollapsed: boolean;
	leftView: LeftPanelView;
	rightView: RightPanelView;
};

/**
 * Tracks whether the command center is currently acting as a navigator or a
 * pure command launcher.
 */
export type CommandCenterMode = "navigate" | "command";

/**
 * Distinguishes navigation targets from executable shell commands inside the
 * unified command-center result list.
 */
export type CommandCenterItemKind =
	| "project"
	| "worktree"
	| "board"
	| "track"
	| "card"
	| "comment"
	| "command";

/**
 * One row in the command center. Each item owns its own execution handler so
 * the shell can reuse existing workflows without reinterpreting result types.
 */
export type CommandCenterItem = {
	id: string;
	mode: CommandCenterMode;
	kind: CommandCenterItemKind;
	section: string;
	title: string;
	subtitle?: string;
	keywords?: string[];
	icon?: string;
	run: () => void | Promise<void>;
};

export type Confirmation = {
	title: string;
	description: string;
	confirmLabel: string;
	destructive?: boolean;
	onConfirm: () => void | Promise<void>;
};

export type CardDraft = {
	title: string;
	description: string;
	column: string;
};

export type ChildProgress = {
	total: number;
	done: number;
};

export type FieldValuesDraft = Record<string, FieldValue>;
