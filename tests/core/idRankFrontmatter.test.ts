import { describe, expect, test } from "bun:test";
import { RANK_ALPHABET } from "../../src/core/constants";
import { parseFrontmatter, writeFrontmatter } from "../../src/core/frontmatter";
import { newId, newSlugId, slugifyIdPart } from "../../src/core/id";
import { rankBetween } from "../../src/core/rank";

describe("filesystem id helpers", () => {
	const slugCases: Array<[string, string, string]> = [
		["Simple title", "fallback", "simple-title"],
		["  Trim Me  ", "fallback", "trim-me"],
		["Ship: macOS + Windows!", "fallback", "ship-macos-windows"],
		["UPPER lower 123", "fallback", "upper-lower-123"],
		["---", "fallback", "fallback"],
		["emoji 🚀 title", "fallback", "emoji-title"],
		["dots.and/slashes", "fallback", "dots-and-slashes"],
		["multiple     spaces", "fallback", "multiple-spaces"],
		["ümlaut café", "fallback", "mlaut-caf"],
		["a".repeat(80), "fallback", "a".repeat(48)],
	];

	for (const [input, fallback, expected] of slugCases) {
		test(`slugifies ${JSON.stringify(input)} as ${expected}`, () => {
			expect(slugifyIdPart(input, fallback)).toBe(expected);
		});
	}

	test("newSlugId includes slug and short random suffix without a type prefix", () => {
		expect(newSlugId("card", "Release prep")).toMatch(/^release-prep-[a-z0-9]{7}$/);
	});

	test("newSlugId uses a neutral slug fallback for punctuation-only titles", () => {
		expect(newSlugId("track", "!!!")).toMatch(/^item-[a-z0-9]{7}$/);
	});

	test("newSlugId never emits path separators or whitespace", () => {
		const id = newSlugId("card", "../release notes/0.1.0");
		expect(id).not.toContain("/");
		expect(id).not.toContain("..");
		expect(id).not.toContain(" ");
	});

	test("newSlugId keeps ids stable-shaped but unique", () => {
		const ids = new Set(Array.from({ length: 20 }, () => newSlugId("card", "Same title")));
		expect(ids.size).toBe(20);
	});

	test("newId returns a plain id without a type prefix", () => {
		expect(newId("agent").startsWith("agent_")).toBe(false);
	});
});

describe("rankBetween", () => {
	const rankCases: Array<[string | null, string | null]> = [
		[null, null],
		[null, "m"],
		["m", null],
		["a", "z"],
		["a", "b"],
		["a0", "a2"],
		["a0", "a1"],
		["az", "b"],
	];

	for (const [previous, next] of rankCases) {
		test(`creates rank between ${previous ?? "start"} and ${next ?? "end"}`, () => {
			const rank = rankBetween(previous, next);
			if (previous) expect(compareRank(rank, previous)).toBeGreaterThan(0);
			if (next) expect(compareRank(rank, next)).toBeLessThan(0);
		});
	}

	test("throws for invalid previous rank characters", () => {
		expect(() => rankBetween("~", null)).toThrow("Invalid rank");
	});

	test("throws for invalid next rank characters", () => {
		expect(() => rankBetween(null, "!")).toThrow("Invalid rank");
	});
});

function compareRank(left: string, right: string): number {
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		if (index >= left.length) return -1;
		if (index >= right.length) return 1;
		const leftValue = RANK_ALPHABET.indexOf(left[index] ?? "");
		const rightValue = RANK_ALPHABET.indexOf(right[index] ?? "");
		if (leftValue !== rightValue) return leftValue - rightValue;
	}
	return 0;
}

describe("frontmatter", () => {
	test("returns empty data when markdown has no frontmatter", () => {
		const parsed = parseFrontmatter("Hello\nworld");
		expect(parsed.data).toEqual({});
		expect(parsed.body).toBe("Hello\nworld");
	});

	test("returns original body when frontmatter is unterminated", () => {
		const input = "---\ntitle: \"Broken\"\nBody";
		const parsed = parseFrontmatter(input);
		expect(parsed.data).toEqual({});
		expect(parsed.body).toBe(input);
	});

	test("parses JSON string values", () => {
		const parsed = parseFrontmatter<{ title: string }>("---\ntitle: \"Card title\"\n---\nBody");
		expect(parsed.data.title).toBe("Card title");
		expect(parsed.body).toBe("Body");
	});

	test("parses arrays, booleans, nulls, and objects", () => {
		const parsed = parseFrontmatter<{ labels: string[]; done: boolean; parent: null; scope: { kind: string } }>(
			"---\nlabels: [\"ui\",\"core\"]\ndone: true\nparent: null\nscope: {\"kind\":\"project\"}\n---\nBody",
		);
		expect(parsed.data.labels).toEqual(["ui", "core"]);
		expect(parsed.data.done).toBe(true);
		expect(parsed.data.parent).toBeNull();
		expect(parsed.data.scope).toEqual({ kind: "project" });
	});

	test("keeps non-json values as raw strings", () => {
		const parsed = parseFrontmatter<{ title: string }>("---\ntitle: Plain title\n---\nBody");
		expect(parsed.data.title).toBe("Plain title");
	});

	test("ignores malformed frontmatter lines", () => {
		const parsed = parseFrontmatter<{ title: string }>("---\nnot-a-pair\ntitle: \"Ok\"\n: nope\n---\nBody");
		expect(parsed.data).toEqual({ title: "Ok" });
	});

	test("normalizes CRLF input", () => {
		const parsed = parseFrontmatter<{ title: string }>("---\r\ntitle: \"Windows\"\r\n---\r\nLine\r\n");
		expect(parsed.data.title).toBe("Windows");
		expect(parsed.body).toBe("Line\n");
	});

	test("writeFrontmatter skips undefined values", () => {
		const written = writeFrontmatter({ title: "Card", ignored: undefined }, "Body");
		expect(written).toContain("title: \"Card\"");
		expect(written).not.toContain("ignored");
	});

	test("writeFrontmatter normalizes CRLF bodies", () => {
		const written = writeFrontmatter({ title: "Card" }, "Line 1\r\nLine 2");
		expect(written.endsWith("Line 1\nLine 2")).toBe(true);
	});

	test("writeFrontmatter round trips nested data", () => {
		const written = writeFrontmatter({
			title: "Card",
			scope: { kind: "track", ref: "release" },
			labels: ["release", "docs"],
		}, "Body");
		const parsed = parseFrontmatter<{ title: string; scope: { kind: string; ref: string }; labels: string[] }>(written);
		expect(parsed.data.scope).toEqual({ kind: "track", ref: "release" });
		expect(parsed.data.labels).toEqual(["release", "docs"]);
		expect(parsed.body).toBe("Body");
	});
});
