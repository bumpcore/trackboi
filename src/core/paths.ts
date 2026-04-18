import path from "node:path";
import { DEFAULT_BOARD_ID, PROJECT_METADATA_FILE } from "./constants";

export function storageRoot(projectPath: string, storagePath: string): string {
	return path.join(projectPath, storagePath);
}

export function boardsPath(rootPath: string): string {
	return path.join(rootPath, "boards");
}

export function boardPath(rootPath: string): string {
	return path.join(boardsPath(rootPath), `${DEFAULT_BOARD_ID}.json`);
}

export function cardsPath(rootPath: string): string {
	return path.join(rootPath, "cards");
}

export function cardPath(rootPath: string, cardId: string): string {
	return path.join(cardsPath(rootPath), `${cardId}.json`);
}

export function tracksPath(rootPath: string): string {
	return path.join(rootPath, "tracks");
}

export function trackPath(rootPath: string, trackId: string): string {
	return path.join(tracksPath(rootPath), `${trackId}.json`);
}

export function trackDirPath(rootPath: string, trackId: string): string {
	return path.join(tracksPath(rootPath), trackId);
}

export function trackFilesPath(rootPath: string, trackId: string): string {
	return path.join(trackDirPath(rootPath, trackId), "files");
}

export function trackFilePath(rootPath: string, trackId: string, fileName: string): string {
	return path.join(trackFilesPath(rootPath, trackId), fileName);
}

export function projectMetadataPath(rootPath: string): string {
	return path.join(rootPath, PROJECT_METADATA_FILE);
}

export const runtimePaths = {
	boardsPath,
	cardsPath,
	boardPath,
	cardPath,
	tracksPath,
	trackPath,
	trackDirPath,
	trackFilesPath,
	trackFilePath,
	projectMetadataPath,
};
