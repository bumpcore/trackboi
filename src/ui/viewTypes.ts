import type { FieldValue } from "@/core/types";

export type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

export type BoardScopeMode = "all" | "global";

export type ScopeMode = "track" | "global" | "existing";

export type LeftPanelView = "explorer" | "agents";

export type RightPanelView = "card" | "track" | "activity" | "context" | "project-settings";

export type WorkspaceShellPrefs = {
	leftWidth: number;
	rightWidth: number;
	leftCollapsed: boolean;
	rightCollapsed: boolean;
	leftView: LeftPanelView;
	rightView: RightPanelView;
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
