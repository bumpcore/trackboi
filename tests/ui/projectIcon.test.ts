import { describe, expect, test } from "bun:test";
import { projectIconSrc } from "../../src/ui/lib/projectIcon";

describe("project icon rendering helpers", () => {
	test("turns absolute local image paths into file urls", () => {
		expect(projectIconSrc({ iconPath: "/tmp/trackboi icon.png" })).toBe("file:///tmp/trackboi%20icon.png");
	});

	test("returns null for missing icon paths", () => {
		expect(projectIconSrc({ iconPath: "  " })).toBeNull();
		expect(projectIconSrc(null)).toBeNull();
	});
});
