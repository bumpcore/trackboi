/// <reference types="vite/client" />

import type { TrackboiBridgeApi, WindowBridgeApi } from "./src/electron/bridge";

declare module "*.vue" {
	import type { DefineComponent } from "vue";
	const component: DefineComponent<object, object, unknown>;
	export default component;
}

declare global {
	interface Window {
		trackboi: TrackboiBridgeApi;
		trackboiWindow: WindowBridgeApi;
	}
}
