import { describe, expect, test } from "bun:test";
import { DEFAULT_ACCENT_COLOR, normalizeAccentColor } from "../../src/ui/composables/useAppPreferences";
import { ACCENT_COLOR_OPTIONS } from "../../src/ui/composables/useThemeMode";

describe("app preferences", () => {
	test("normalizes accent color preferences to supported palette ids", () => {
		expect(normalizeAccentColor("blue")).toBe("blue");
		expect(normalizeAccentColor("green")).toBe("green");
		expect(normalizeAccentColor("rose")).toBe("rose");
		expect(normalizeAccentColor("violet")).toBe("violet");
		expect(normalizeAccentColor("")).toBe(DEFAULT_ACCENT_COLOR);
		expect(normalizeAccentColor("chartreuse")).toBe(DEFAULT_ACCENT_COLOR);
	});

	test("defines theme tokens for every accent option", () => {
		expect(ACCENT_COLOR_OPTIONS.map((option) => option.value)).toEqual(["amber", "blue", "green", "rose", "violet"]);

		for (const option of ACCENT_COLOR_OPTIONS) {
			expect(option.dark.primary).toBeTruthy();
			expect(option.dark.primaryForeground).toBeTruthy();
			expect(option.light.primary).toBeTruthy();
			expect(option.light.primaryForeground).toBeTruthy();
		}
	});
});
