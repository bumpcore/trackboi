import type {
	AppSettings,
	Board,
	BoardDescriptor,
	Card,
	DesktopState,
	ProjectMetadata,
	ProjectView,
	Track,
	TrackboiActions,
	WorktreeContext,
} from "../core";

export type DesktopStorePatch =
	| { type: "contextReplaced"; state: DesktopState }
	| { type: "viewUpdated"; view: ProjectView }
	| { type: "selectionUpdated"; activeProjectPath?: string | null; selectedWorktreeId?: string | null; selectedBoardId?: string | null }
	| { type: "worktreesReplaced"; projectPath: string | null; worktrees: WorktreeContext[] }
	| { type: "boardUpserted"; board: Board; boards?: BoardDescriptor[]; selectedBoardId?: string | null }
	| { type: "boardRemoved"; boardId: string; boards?: BoardDescriptor[]; selectedBoardId?: string | null }
	| { type: "trackUpserted"; track: Track }
	| { type: "trackRemoved"; trackId: string; detachCardIds?: string[] }
	| { type: "cardUpserted"; card: Card }
	| { type: "cardRemoved"; cardId: string }
	| { type: "cardMoved"; cardId: string; toColumn: string; beforeCardId: string | null; rank: string }
	| { type: "metadataUpdated"; metadata: ProjectMetadata }
	| { type: "appSettingsUpdated"; appSettings: AppSettings }
	| { type: "storagePathsUpdated"; storageSearchPaths: string[] };

export type TrackboiBridgeApi = TrackboiActions & {
	onDesktopStorePatch(listener: (patch: DesktopStorePatch) => void): () => void;
	listDetectedEditors(): Promise<DetectedEditor[]>;
	openCardInEditor(cardId: string): Promise<{ ok: true }>;
};

export type DetectedEditor = {
	id: string;
	label: string;
	command: string;
};

export type WindowBridgeApi = {
	minimize(): Promise<void>;
	toggleMaximize(): Promise<void>;
	close(): Promise<void>;
	startDrag(): Promise<void>;
	startResize(edge: string): Promise<void>;
};
