import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_BOARD_ID } from "./constants";
import { newId } from "./id";
import { readJson, writeJsonAtomic } from "./json";
import { trackFilePath, trackFilesPath, trackPath, tracksPath } from "./paths";
import { now, type ProjectStore } from "./storage";
import type {
	CreateTrackInput,
	Track,
	TrackFile,
	TrackFileReadResult,
	TrackFileWriteInput,
	TrackPatch,
	TrackSource,
} from "./types";

export function readTracks(rootPath: string): Track[] {
	const trackRoot = tracksPath(rootPath);
	if (!existsSync(trackRoot)) return [];

	const tracks: Track[] = [];
	for (const entry of readdirSync(trackRoot, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		const filePath = path.join(trackRoot, entry.name);
		const track = normalizeTrack(readJson<Track>(filePath));
		track.files = listTrackFiles(rootPath, track.id);
		tracks.push(track);
	}

	tracks.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));
	return tracks;
}

export function createTrackInStore(store: ProjectStore, input: CreateTrackInput): Track {
	const title = input.title.trim();
	if (!title) throw new Error("Track title is required");

	const timestamp = now();
	const track: Track = {
		id: newId("track"),
		boardId: DEFAULT_BOARD_ID,
		title,
		slug: slugifyTrackTitle(title),
		source: normalizeTrackSource(input.source),
		summary: input.summary?.trim() ?? "",
		plan: input.plan?.trim() ?? "",
		decisions: [],
		references: [],
		activity: [],
		files: [],
		createdAt: timestamp,
		updatedAt: timestamp,
	};
	writeJsonAtomic(trackPath(store.rootPath, track.id), track);
	return track;
}

export function updateTrackInStore(store: ProjectStore, trackId: string, patch: TrackPatch): Track {
	const filePath = trackPath(store.rootPath, trackId);
	const current = normalizeTrack(readJson<Track>(filePath));
	const next: Track = {
		...current,
		title: typeof patch.title === "string" ? patch.title.trim() : current.title,
		source: patch.source ? normalizeTrackSource(patch.source) : current.source,
		summary: typeof patch.summary === "string" ? patch.summary.trim() : current.summary,
		plan: typeof patch.plan === "string" ? patch.plan.trim() : current.plan,
		decisions: Array.isArray(patch.decisions) ? patch.decisions : current.decisions,
		references: Array.isArray(patch.references) ? patch.references : current.references,
		activity: Array.isArray(patch.activity) ? patch.activity : current.activity,
		updatedAt: now(),
	};
	if (!next.title) throw new Error("Track title is required");
	writeJsonAtomic(filePath, next);
	return {
		...next,
		files: listTrackFiles(store.rootPath, trackId),
	};
}

export function deleteTrackInStore(store: ProjectStore, trackId: string): { ok: true } {
	rmSync(trackPath(store.rootPath, trackId), { force: true });
	rmSync(path.join(tracksPath(store.rootPath), trackId), { recursive: true, force: true });
	return { ok: true };
}

export function readTrackFileInStore(store: ProjectStore, trackId: string, fileName: string): TrackFileReadResult {
	const safeName = sanitizeTrackFileName(fileName);
	const fullPath = trackFilePath(store.rootPath, trackId, safeName);
	if (!existsSync(fullPath)) throw new Error(`Unknown track file: ${safeName}`);
	return {
		name: safeName,
		content: readFileSync(fullPath, "utf8"),
		contentType: inferTrackFileContentType(safeName),
	};
}

export function writeTrackFileInStore(store: ProjectStore, input: TrackFileWriteInput): TrackFile {
	const safeName = sanitizeTrackFileName(input.name);
	mkdirSync(trackFilesPath(store.rootPath, input.trackId), { recursive: true });
	writeFileSync(trackFilePath(store.rootPath, input.trackId, safeName), input.content, "utf8");
	touchTrack(store, input.trackId);
	return listTrackFiles(store.rootPath, input.trackId).find((file) => file.name === safeName)
		?? {
			name: safeName,
			path: path.join("tracks", input.trackId, "files", safeName),
			contentType: input.contentType ?? inferTrackFileContentType(safeName),
			updatedAt: now(),
		};
}

export function deleteTrackFileInStore(store: ProjectStore, trackId: string, fileName: string): { ok: true } {
	const safeName = sanitizeTrackFileName(fileName);
	rmSync(trackFilePath(store.rootPath, trackId, safeName), { force: true });
	touchTrack(store, trackId);
	return { ok: true };
}

export function slugifyTrackTitle(title: string): string {
	return title
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80) || "track";
}

export function sanitizeTrackFileName(fileName: string): string {
	const normalized = fileName.trim();
	if (!normalized) throw new Error("Track file name is required");
	if (normalized !== path.basename(normalized) || normalized.includes("..")) {
		throw new Error("Track file names must stay within the track files folder");
	}
	return normalized;
}

function listTrackFiles(rootPath: string, trackId: string): TrackFile[] {
	const filesDir = trackFilesPath(rootPath, trackId);
	if (!existsSync(filesDir)) return [];

	const files: TrackFile[] = [];
	for (const entry of readdirSync(filesDir, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const fullPath = path.join(filesDir, entry.name);
		const stats = statSync(fullPath);
		files.push({
			name: entry.name,
			path: path.join("tracks", trackId, "files", entry.name),
			contentType: inferTrackFileContentType(entry.name),
			updatedAt: stats.mtime.toISOString(),
		});
	}
	files.sort((left, right) => left.name.localeCompare(right.name));
	return files;
}

function touchTrack(store: ProjectStore, trackId: string): void {
	const filePath = trackPath(store.rootPath, trackId);
	const current = normalizeTrack(readJson<Track>(filePath));
	writeJsonAtomic(filePath, {
		...current,
		updatedAt: now(),
	});
}

function inferTrackFileContentType(fileName: string): string {
	const extension = path.extname(fileName).toLowerCase();
	switch (extension) {
		case ".md":
			return "text/markdown";
		case ".json":
			return "application/json";
		case ".ts":
		case ".tsx":
		case ".js":
		case ".jsx":
		case ".css":
		case ".html":
		case ".vue":
		case ".txt":
		default:
			return "text/plain";
	}
}

function normalizeTrack(track: Track): Track {
	return {
		id: track.id,
		boardId: track.boardId || DEFAULT_BOARD_ID,
		title: track.title,
		slug: typeof track.slug === "string" && track.slug.length > 0 ? track.slug : slugifyTrackTitle(track.title),
		source: normalizeTrackSource(track.source),
		summary: typeof track.summary === "string" ? track.summary : "",
		plan: typeof track.plan === "string" ? track.plan : "",
		decisions: Array.isArray(track.decisions) ? track.decisions : [],
		references: Array.isArray(track.references) ? track.references : [],
		activity: Array.isArray(track.activity) ? track.activity : [],
		files: [],
		createdAt: typeof track.createdAt === "string" ? track.createdAt : now(),
		updatedAt: typeof track.updatedAt === "string" ? track.updatedAt : now(),
	};
}

function normalizeTrackSource(source: TrackSource | undefined): TrackSource {
	if (source?.kind === "branch" && source.ref.trim()) {
		return { kind: "branch", ref: source.ref.trim() };
	}
	return { kind: "manual" };
}
