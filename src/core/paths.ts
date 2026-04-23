import path from "node:path";
import { DEFAULT_BOARD_ID, PROJECT_METADATA_FILE } from "./constants";

export function storageRoot(projectPath: string, storagePath: string): string {
	return path.join(projectPath, storagePath);
}

export function boardsPath(rootPath: string): string {
	return path.join(rootPath, "boards");
}

export function boardPath(rootPath: string, boardId = DEFAULT_BOARD_ID): string {
	return path.join(boardsPath(rootPath), `${boardId}.json`);
}

export function cardsPath(rootPath: string): string {
	return path.join(rootPath, "cards");
}

export function cardDirPath(rootPath: string, cardId: string): string {
	return path.join(cardsPath(rootPath), cardId);
}

export function cardPath(rootPath: string, cardId: string): string {
	return path.join(cardDirPath(rootPath, cardId), "index.md");
}

export function cardCommentsPath(rootPath: string, cardId: string): string {
	return path.join(cardDirPath(rootPath, cardId), "comments");
}

export function cardCommentPath(rootPath: string, cardId: string, commentId: string): string {
	return path.join(cardCommentsPath(rootPath, cardId), `${commentId}.md`);
}

export function tracksPath(rootPath: string): string {
	return path.join(rootPath, "tracks");
}

export function trackPath(rootPath: string, trackId: string): string {
	return path.join(trackDirPath(rootPath, trackId), "index.md");
}

export function trackBriefPath(rootPath: string, trackId: string): string {
	return path.join(trackDirPath(rootPath, trackId), "brief.md");
}

export function trackDecisionsPath(rootPath: string, trackId: string): string {
	return path.join(trackDirPath(rootPath, trackId), "decisions.md");
}

export function trackReferencesPath(rootPath: string, trackId: string): string {
	return path.join(trackDirPath(rootPath, trackId), "references.md");
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
	cardDirPath,
	boardPath,
	cardPath,
	cardCommentsPath,
	cardCommentPath,
	tracksPath,
	trackPath,
	trackBriefPath,
	trackDecisionsPath,
	trackReferencesPath,
	trackDirPath,
	trackFilesPath,
	trackFilePath,
	projectMetadataPath,
};
