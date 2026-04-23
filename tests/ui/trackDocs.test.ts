import { describe, expect, test } from "bun:test";
import { normalizeTrackDocName } from "../../src/ui/lib/trackDocs";

describe("track docs", () => {
	test("normalizes user-entered track doc names to markdown files", () => {
		expect(normalizeTrackDocName("notes")).toBe("notes.md");
		expect(normalizeTrackDocName(" notes.md ")).toBe("notes.md");
		expect(normalizeTrackDocName("NOTES.MD")).toBe("NOTES.MD");
		expect(normalizeTrackDocName("")).toBe("");
	});
});
