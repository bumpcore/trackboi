import { existsSync, readdirSync, type FSWatcher, watch } from "node:fs";

type TrackboiPaths = {
	boardsPath(rootPath: string): string;
	cardsPath(rootPath: string): string;
	tracksPath(rootPath: string): string;
	trackFilesPath(rootPath: string, trackId: string): string;
};

/**
 * Watches repo-local Trackboi storage roots and debounces change forwarding so
 * the renderer can refresh once per burst instead of once per file event.
 */
export function createProjectStorageWatcher(options: {
	paths: TrackboiPaths;
	onProjectChanged(rootPath: string): void;
}) {
	let activeWatchers: FSWatcher[] = [];
	let watcherTimer: ReturnType<typeof setTimeout> | null = null;

	function queueProjectChanged(rootPath: string): void {
		if (watcherTimer) clearTimeout(watcherTimer);
		watcherTimer = setTimeout(() => {
			options.onProjectChanged(rootPath);
		}, 120);
	}

	function refresh(rootPaths: string[]): void {
		dispose();
		for (const rootPath of rootPaths) {
			for (const targetPath of [
				rootPath,
				options.paths.boardsPath(rootPath),
				options.paths.cardsPath(rootPath),
				options.paths.tracksPath(rootPath),
			]) {
				if (!existsSync(targetPath)) continue;
				activeWatchers.push(watch(targetPath, () => queueProjectChanged(rootPath)));
			}

			const tracksRoot = options.paths.tracksPath(rootPath);
			if (!existsSync(tracksRoot)) continue;
			for (const entry of readdirSync(tracksRoot, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				const filesPath = options.paths.trackFilesPath(rootPath, entry.name);
				if (!existsSync(filesPath)) continue;
				activeWatchers.push(watch(filesPath, () => queueProjectChanged(rootPath)));
			}
		}
	}

	function dispose(): void {
		for (const watcher of activeWatchers) watcher.close();
		activeWatchers = [];
		if (watcherTimer) {
			clearTimeout(watcherTimer);
			watcherTimer = null;
		}
	}

	return {
		refresh,
		dispose,
	};
}
