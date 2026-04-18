import type { TrackboiActions } from "../core";

export type ProjectChangedPayload = {
	rootPath: string;
};

export type TrackboiBridgeApi = TrackboiActions & {
	onProjectChanged(listener: (payload: ProjectChangedPayload) => void): () => void;
};

export type WindowBridgeApi = {
	minimize(): Promise<void>;
	toggleMaximize(): Promise<void>;
	close(): Promise<void>;
	startDrag(): Promise<void>;
	startResize(edge: string): Promise<void>;
};
