import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseFrontmatter, writeFrontmatter } from "./frontmatter";
import { newSlugId } from "./id";
import { trackBriefPath, trackDecisionsPath, trackDirPath, trackFilePath, trackFilesPath, trackPath, trackReferencesPath, tracksPath } from "./paths";
import { now, type ProjectStore } from "./storage";
import type {
	CreateTrackInput,
	Track,
	TrackDecision,
	TrackDecisionStatus,
	TrackFile,
	TrackFileReadResult,
	TrackFileWriteInput,
	TrackPatch,
	TrackReference,
	TrackReferenceKind,
} from "./types";

const DECISION_STATUSES = new Set<TrackDecisionStatus>(["proposed", "accepted", "rejected"]);
const REFERENCE_KINDS = new Set<TrackReferenceKind>(["card", "path", "branch", "worktree", "url"]);

export function readTracks(rootPath: string): Track[] {
	const trackRoot = tracksPath(rootPath);
	if (!existsSync(trackRoot)) return [];

	const tracks: Track[] = [];
	for (const entry of readdirSync(trackRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const indexPath = trackPath(rootPath, entry.name);
		if (!existsSync(indexPath)) continue;
		tracks.push(readTrack(rootPath, entry.name));
	}

	tracks.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title));
	return tracks;
}

export function createTrackInStore(store: ProjectStore, input: CreateTrackInput): Track {
	const title = input.title.trim();
	if (!title) throw new Error("Track title is required");

	const timestamp = now();
	const track: Track = {
		id: newSlugId("track", title),
		title,
		slug: slugifyTrackTitle(title),
		summary: input.summary?.trim() ?? "",
		brief: input.brief?.trim() ?? "",
		decisions: [],
		references: [],
		files: [],
		createdAt: timestamp,
		updatedAt: timestamp,
		createdBy: input.actorId ?? "person_unknown",
		updatedBy: input.actorId ?? "person_unknown",
	};
	writeTrack(store.rootPath, track, {
		brief: true,
		decisions: true,
		references: true,
	});
	return track;
}

export function updateTrackInStore(store: ProjectStore, trackId: string, patch: TrackPatch): Track {
	const current = readTrack(store.rootPath, trackId);
	const next: Track = {
		...current,
		title: typeof patch.title === "string" ? patch.title.trim() : current.title,
		summary: typeof patch.summary === "string" ? patch.summary.trim() : current.summary,
		brief: typeof patch.brief === "string" ? patch.brief.trim() : current.brief,
		decisions: Array.isArray(patch.decisions) ? patch.decisions : current.decisions,
		references: Array.isArray(patch.references) ? patch.references : current.references,
		updatedAt: now(),
		createdBy: current.createdBy ?? "person_unknown",
		updatedBy: patch.actorId ?? current.updatedBy ?? current.createdBy ?? "person_unknown",
	};
	if (!next.title) throw new Error("Track title is required");
	next.slug = slugifyTrackTitle(next.title);
	writeTrack(store.rootPath, next, {
		brief: typeof patch.brief === "string",
		decisions: Array.isArray(patch.decisions),
		references: Array.isArray(patch.references),
	});
	return readTrack(store.rootPath, trackId);
}

export function deleteTrackInStore(store: ProjectStore, trackId: string): { ok: true } {
	rmSync(trackDirPath(store.rootPath, trackId), { recursive: true, force: true });
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
	if (path.extname(normalized).toLowerCase() !== ".md") {
		throw new Error("Track files must be markdown files");
	}
	return normalized;
}

function readTrack(rootPath: string, trackId: string): Track {
	const parsed = parseFrontmatter<Partial<Track>>(readFileSync(trackPath(rootPath, trackId), "utf8"));
	const timestamp = typeof parsed.data.updatedAt === "string" ? parsed.data.updatedAt : now();
	const id = typeof parsed.data.id === "string" && parsed.data.id ? parsed.data.id : trackId;
	const title = typeof parsed.data.title === "string" && parsed.data.title.trim() ? parsed.data.title.trim() : id;
	const track: Track = {
		id,
		title,
		slug: typeof parsed.data.slug === "string" && parsed.data.slug ? parsed.data.slug : slugifyTrackTitle(title),
		summary: parsed.body.trim(),
		brief: readTextFile(trackBriefPath(rootPath, id)),
		decisions: readDecisions(rootPath, id, timestamp),
		references: readReferences(rootPath, id),
		files: listTrackFiles(rootPath, id),
		createdAt: typeof parsed.data.createdAt === "string" ? parsed.data.createdAt : timestamp,
		updatedAt: timestamp,
		createdBy: typeof parsed.data.createdBy === "string" ? parsed.data.createdBy : "person_unknown",
		updatedBy: typeof parsed.data.updatedBy === "string" ? parsed.data.updatedBy : "person_unknown",
	};
	return track;
}

function writeTrack(
	rootPath: string,
	track: Track,
	options: { brief?: boolean; decisions?: boolean; references?: boolean } = {},
): void {
	mkdirSync(trackDirPath(rootPath, track.id), { recursive: true });
	mkdirSync(trackFilesPath(rootPath, track.id), { recursive: true });
	writeFileSync(trackPath(rootPath, track.id), writeFrontmatter({
		id: track.id,
		title: track.title,
		slug: track.slug,
		createdAt: track.createdAt,
		updatedAt: track.updatedAt,
		createdBy: track.createdBy,
		updatedBy: track.updatedBy,
	}, track.summary), "utf8");
	if (options.brief) writeFileSync(trackBriefPath(rootPath, track.id), normalizeMarkdownDoc(track.brief), "utf8");
	if (options.decisions) writeFileSync(trackDecisionsPath(rootPath, track.id), writeDecisions(track.decisions), "utf8");
	if (options.references) writeFileSync(trackReferencesPath(rootPath, track.id), writeReferences(track.references), "utf8");
}

function readTextFile(filePath: string): string {
	return existsSync(filePath) ? readFileSync(filePath, "utf8").trim() : "";
}

function normalizeMarkdownDoc(content: string): string {
	const normalized = content.replace(/\r\n/g, "\n").trim();
	return normalized ? `${normalized}\n` : "";
}

function readDecisions(rootPath: string, trackId: string, timestamp: string): TrackDecision[] {
	const filePath = trackDecisionsPath(rootPath, trackId);
	if (!existsSync(filePath)) return [];
	const lines = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").split("\n");
	const decisions: TrackDecision[] = [];
	let current: { status: TrackDecisionStatus; title: string; body: string[] } | null = null;

	function flush() {
		if (!current) return;
		const index = decisions.length + 1;
		decisions.push({
			id: `decision_${index}_${slugifyTrackTitle(current.title)}`,
			title: current.title,
			body: current.body.join("\n").trim(),
			status: current.status,
			createdAt: timestamp,
			updatedAt: timestamp,
		});
		current = null;
	}

	for (const line of lines) {
		const heading = line.match(/^##\s+(?:\[([^\]]+)\]\s*)?(.+)$/);
		if (heading) {
			flush();
			const rawStatus = heading[1]?.trim().toLowerCase();
			const status = DECISION_STATUSES.has(rawStatus as TrackDecisionStatus) ? rawStatus as TrackDecisionStatus : "accepted";
			current = { status, title: heading[2]?.trim() || "Decision", body: [] };
			continue;
		}
		if (current) current.body.push(line);
	}
	flush();
	return decisions;
}

function writeDecisions(decisions: TrackDecision[]): string {
	const body = decisions.map((decision) => [
		`## [${normalizeDecisionStatus(decision.status)}] ${decision.title.trim() || "Decision"}`,
		"",
		decision.body.trim(),
	].filter((line, index) => index < 2 || line.length > 0).join("\n")).join("\n\n");
	return `# Decisions\n${body ? `\n${body}\n` : ""}`;
}

function readReferences(rootPath: string, trackId: string): TrackReference[] {
	const filePath = trackReferencesPath(rootPath, trackId);
	if (!existsSync(filePath)) return [];
	const references: TrackReference[] = [];
	for (const line of readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").split("\n")) {
		const match = line.match(/^\s*-\s+\[([^\]]+)\]\s+([^:]+):\s*(.+)$/);
		if (!match) continue;
		const kind = match[1]?.trim().toLowerCase();
		if (!REFERENCE_KINDS.has(kind as TrackReferenceKind)) continue;
		const label = match[2]?.trim();
		const value = match[3]?.trim();
		if (!label || !value) continue;
		references.push({
			id: `reference_${references.length + 1}_${slugifyTrackTitle(label)}`,
			kind: kind as TrackReferenceKind,
			label,
			value,
		});
	}
	return references;
}

function writeReferences(references: TrackReference[]): string {
	const body = references
		.map((reference) => `- [${normalizeReferenceKind(reference.kind)}] ${reference.label.trim()}: ${reference.value.trim()}`)
		.join("\n");
	return `# References\n${body ? `\n${body}\n` : ""}`;
}

function listTrackFiles(rootPath: string, trackId: string): TrackFile[] {
	const filesDir = trackFilesPath(rootPath, trackId);
	if (!existsSync(filesDir)) return [];

	const files: TrackFile[] = [];
	for (const entry of readdirSync(filesDir, { withFileTypes: true })) {
		if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") continue;
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
	const current = readTrack(store.rootPath, trackId);
	writeTrack(store.rootPath, {
		...current,
		updatedAt: now(),
	});
}

function inferTrackFileContentType(_fileName: string): string {
	return "text/markdown";
}

function normalizeDecisionStatus(status: TrackDecisionStatus | string | undefined): TrackDecisionStatus {
	return DECISION_STATUSES.has(status as TrackDecisionStatus) ? status as TrackDecisionStatus : "accepted";
}

function normalizeReferenceKind(kind: TrackReferenceKind | string | undefined): TrackReferenceKind {
	return REFERENCE_KINDS.has(kind as TrackReferenceKind) ? kind as TrackReferenceKind : "path";
}
