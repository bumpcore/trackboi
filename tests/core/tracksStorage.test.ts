import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeFrontmatter } from "../../src/core/frontmatter";
import {
	createTrackInStore,
	deleteTrackFileInStore,
	deleteTrackInStore,
	readTrackFileInStore,
	readTracks,
	sanitizeTrackFileName,
	slugifyTrackTitle,
	updateTrackInStore,
	writeTrackFileInStore,
} from "../../src/core/tracks";
import type { ProjectStore } from "../../src/core/storage";
import type { TrackDecision, TrackReference } from "../../src/core/types";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("track title and file name helpers", () => {
	const slugCases: Array<[string, string]> = [
		["Release Prep", "release-prep"],
		["  Trim Me  ", "trim-me"],
		["MCP + Claude setup", "mcp-claude-setup"],
		["UPPER lower 123", "upper-lower-123"],
		["---", "track"],
		["a".repeat(120), "a".repeat(80)],
	];

	for (const [input, expected] of slugCases) {
		test(`slugifyTrackTitle normalizes ${JSON.stringify(input)}`, () => {
			expect(slugifyTrackTitle(input)).toBe(expected);
		});
	}

	const validFileNames = ["brief.md", "Release Notes.md", "nested-name_01.md", "UPPER.MD"];
	for (const fileName of validFileNames) {
		test(`sanitizeTrackFileName accepts ${fileName}`, () => {
			expect(sanitizeTrackFileName(` ${fileName} `)).toBe(fileName);
		});
	}

	const invalidFileNames = ["", "notes.txt", "../escape.md", "nested/file.md", "bad..md"];
	for (const fileName of invalidFileNames) {
		test(`sanitizeTrackFileName rejects ${JSON.stringify(fileName)}`, () => {
			expect(() => sanitizeTrackFileName(fileName)).toThrow();
		});
	}
});

describe("track storage", () => {
	test("createTrackInStore writes index, brief, decisions, references, and files folder", () => {
		const store = createStore();
		const track = createTrackInStore(store, {
			title: "Release readiness",
			summary: "Ship it.",
			brief: "Detailed release context.",
			actorId: "agent_codex",
		});

		expect(track.id).toMatch(/^track-release-readiness-[a-z0-9]{7}$/);
		expect(track.slug).toBe("release-readiness");
		expect(track.createdBy).toBe("agent_codex");
		expect(existsSync(path.join(store.rootPath, "tracks", track.id, "index.md"))).toBe(true);
		expect(existsSync(path.join(store.rootPath, "tracks", track.id, "brief.md"))).toBe(true);
		expect(existsSync(path.join(store.rootPath, "tracks", track.id, "decisions.md"))).toBe(true);
		expect(existsSync(path.join(store.rootPath, "tracks", track.id, "references.md"))).toBe(true);
		expect(existsSync(path.join(store.rootPath, "tracks", track.id, "files"))).toBe(true);
	});

	test("readTracks returns tracks sorted by updatedAt desc then title", () => {
		const store = createStore();
		writeTrackIndex(store.rootPath, "track_old", "Zulu", "2026-01-01T00:00:00.000Z");
		writeTrackIndex(store.rootPath, "track_new_b", "Beta", "2026-01-02T00:00:00.000Z");
		writeTrackIndex(store.rootPath, "track_new_a", "Alpha", "2026-01-02T00:00:00.000Z");

		expect(readTracks(store.rootPath).map((track) => track.id)).toEqual(["track_new_a", "track_new_b", "track_old"]);
	});

	test("readTracks ignores non-directory entries and directories without index files", () => {
		const store = createStore();
		mkdirSync(path.join(store.rootPath, "tracks", "empty"), { recursive: true });
		writeFileSync(path.join(store.rootPath, "tracks", "loose.md"), "nope");
		writeTrackIndex(store.rootPath, "track_real", "Real", "2026-01-01T00:00:00.000Z");

		expect(readTracks(store.rootPath).map((track) => track.id)).toEqual(["track_real"]);
	});

	test("readTracks normalizes missing metadata from legacy track files", () => {
		const store = createStore();
		const root = path.join(store.rootPath, "tracks", "legacy_track");
		mkdirSync(root, { recursive: true });
		writeFileSync(path.join(root, "index.md"), "Legacy body");

		const [track] = readTracks(store.rootPath);
		expect(track?.id).toBe("legacy_track");
		expect(track?.title).toBe("legacy_track");
		expect(track?.slug).toBe("legacy-track");
		expect(track?.summary).toBe("Legacy body");
		expect(track?.createdBy).toBe("person_unknown");
	});

	test("updateTrackInStore changes title, slug, summary, brief, and actor", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "Original", summary: "Before" });
		const updated = updateTrackInStore(store, track.id, {
			title: "Updated Track",
			summary: "After",
			brief: "New brief",
			actorId: "agent_two",
		});

		expect(updated.title).toBe("Updated Track");
		expect(updated.slug).toBe("updated-track");
		expect(updated.summary).toBe("After");
		expect(updated.brief).toBe("New brief");
		expect(updated.updatedBy).toBe("agent_two");
	});

	test("updateTrackInStore rejects empty titles", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "Original" });
		expect(() => updateTrackInStore(store, track.id, { title: "   " })).toThrow("Track title is required");
	});

	test("updateTrackInStore writes decisions in markdown storage format", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "Decisions" });
		const decisions: TrackDecision[] = [{
			id: "decision_1",
			title: "Use local storage",
			body: "It keeps the app git-native.",
			status: "accepted",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		}];

		const updated = updateTrackInStore(store, track.id, { decisions });
		expect(updated.decisions).toMatchObject([{ title: "Use local storage", status: "accepted" }]);
		expect(readFileSync(path.join(store.rootPath, "tracks", track.id, "decisions.md"), "utf8")).toContain("## [accepted] Use local storage");
	});

	test("updateTrackInStore writes references in markdown storage format", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "References" });
		const references: TrackReference[] = [{
			id: "reference_1",
			kind: "url",
			label: "GitHub",
			value: "https://github.com/bumpcore/trackboi",
		}];

		const updated = updateTrackInStore(store, track.id, { references });
		expect(updated.references).toMatchObject([{ kind: "url", label: "GitHub" }]);
		expect(readFileSync(path.join(store.rootPath, "tracks", track.id, "references.md"), "utf8")).toContain("- [url] GitHub:");
	});

	test("readTracks parses decision statuses and defaults unknown statuses to accepted", () => {
		const store = createStore();
		writeTrackIndex(store.rootPath, "track_decisions", "Decisions", "2026-01-01T00:00:00.000Z");
		writeFileSync(path.join(store.rootPath, "tracks", "track_decisions", "decisions.md"), [
			"# Decisions",
			"",
			"## [proposed] Try updater",
			"Need more testing.",
			"",
			"## [weird] Keep local files",
			"Fallback status.",
		].join("\n"));

		const [track] = readTracks(store.rootPath);
		expect(track?.decisions.map((decision) => decision.status)).toEqual(["proposed", "accepted"]);
		expect(track?.decisions[0]?.body).toBe("Need more testing.");
	});

	test("readTracks parses supported references and skips invalid ones", () => {
		const store = createStore();
		writeTrackIndex(store.rootPath, "track_refs", "Refs", "2026-01-01T00:00:00.000Z");
		writeFileSync(path.join(store.rootPath, "tracks", "track_refs", "references.md"), [
			"# References",
			"- [path] Source: src/core/runtime.ts",
			"- [url] Repo: https://github.com/bumpcore/trackboi",
			"- [unknown] Nope: value",
			"- not a reference",
		].join("\n"));

		const [track] = readTracks(store.rootPath);
		expect(track?.references.map((reference) => reference.kind)).toEqual(["path", "url"]);
		expect(track?.references.map((reference) => reference.label)).toEqual(["Source", "Repo"]);
	});

	test("track files are listed alphabetically and markdown-only", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "Files" });
		const filesRoot = path.join(store.rootPath, "tracks", track.id, "files");
		writeFileSync(path.join(filesRoot, "b.md"), "B");
		writeFileSync(path.join(filesRoot, "a.md"), "A");
		writeFileSync(path.join(filesRoot, "ignore.txt"), "No");

		const [readBack] = readTracks(store.rootPath);
		expect(readBack?.files.map((file) => file.name)).toEqual(["a.md", "b.md"]);
		expect(readBack?.files.every((file) => file.contentType === "text/markdown")).toBe(true);
	});

	test("writeTrackFileInStore writes and readTrackFileInStore reads markdown files", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "Files" });

		const file = writeTrackFileInStore(store, {
			trackId: track.id,
			name: "handoff.md",
			content: "Handoff notes",
		});
		const readBack = readTrackFileInStore(store, track.id, "handoff.md");

		expect(file.name).toBe("handoff.md");
		expect(readBack).toEqual({
			name: "handoff.md",
			content: "Handoff notes",
			contentType: "text/markdown",
		});
	});

	test("readTrackFileInStore rejects unknown files", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "Files" });
		expect(() => readTrackFileInStore(store, track.id, "missing.md")).toThrow("Unknown track file");
	});

	test("deleteTrackFileInStore removes the file and touches the track", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "Files" });
		writeTrackFileInStore(store, { trackId: track.id, name: "handoff.md", content: "Handoff" });

		deleteTrackFileInStore(store, track.id, "handoff.md");
		expect(existsSync(path.join(store.rootPath, "tracks", track.id, "files", "handoff.md"))).toBe(false);
	});

	test("deleteTrackInStore removes the entire track directory", () => {
		const store = createStore();
		const track = createTrackInStore(store, { title: "Delete me" });
		deleteTrackInStore(store, track.id);
		expect(existsSync(path.join(store.rootPath, "tracks", track.id))).toBe(false);
	});
});

function createStore(): ProjectStore {
	const rootPath = mkdtempSync(path.join(os.tmpdir(), "trackboi-tracks-"));
	roots.push(rootPath);
	mkdirSync(path.join(rootPath, "tracks"), { recursive: true });
	return {
		project: { name: "repo", path: rootPath, storagePath: ".trackboi" },
		rootPath,
		storagePath: ".trackboi",
	};
}

function writeTrackIndex(rootPath: string, id: string, title: string, updatedAt: string): void {
	const root = path.join(rootPath, "tracks", id);
	mkdirSync(path.join(root, "files"), { recursive: true });
	writeFileSync(path.join(root, "index.md"), writeFrontmatter({
		id,
		title,
		slug: slugifyTrackTitle(title),
		createdAt: updatedAt,
		updatedAt,
		createdBy: "person_fixture",
		updatedBy: "person_fixture",
	}, `${title} summary`));
}
