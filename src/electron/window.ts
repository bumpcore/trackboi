import type { WindowBridgeApi } from "./bridge";

export type WindowShell = WindowBridgeApi;

/**
 * Wraps shell window controls in a dedicated facade so the UI never reaches for
 * IPC channel names directly.
 */
export function createWindowShell(api: WindowBridgeApi): WindowShell {
	return {
		minimize: () => api.minimize(),
		toggleMaximize: () => api.toggleMaximize(),
		close: () => api.close(),
		startDrag: () => api.startDrag(),
		startResize: (edge) => api.startResize(edge),
	};
}

const defaultWindowBridge = new Proxy({} as WindowBridgeApi, {
	get(_target, property) {
		return window.trackboiWindow[property as keyof WindowBridgeApi];
	},
});

export const windowShell = createWindowShell(defaultWindowBridge);
