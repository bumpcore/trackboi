import type { TrackboiActions } from "../core";

export type ProjectChangedPayload = {
	rootPath: string;
};

export type TrackboiBridgeApi = TrackboiActions & {
	onProjectChanged(listener: (payload: ProjectChangedPayload) => void): () => void;
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
