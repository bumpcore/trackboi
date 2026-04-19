import { describe, expect, test } from "bun:test";
import {
	isEditableTarget,
	matchesShortcut,
	normalizeShortcut,
	shortcutFromKeyboardEvent,
} from "../../src/ui/lib/keyboardShortcuts";

describe("keyboard shortcuts", () => {
	function keyboardEvent(init: Partial<KeyboardEvent> & { key: string }) {
		return init as KeyboardEvent;
	}

	test("normalizes shortcut strings into stable modifier order", () => {
		expect(normalizeShortcut("shift + ctrl + x")).toBe("Ctrl+Shift+X");
		expect(normalizeShortcut("meta+alt+arrowleft")).toBe("Alt+Meta+ArrowLeft");
	});

	test("builds shortcut strings from keyboard events", () => {
		const event = keyboardEvent({ key: "b", ctrlKey: true });
		expect(shortcutFromKeyboardEvent(event)).toBe("Ctrl+B");
	});

	test("ignores pure modifier presses during capture", () => {
		const event = keyboardEvent({ key: "Shift", shiftKey: true });
		expect(shortcutFromKeyboardEvent(event)).toBeNull();
	});

	test("matches keyboard events against configured shortcuts", () => {
		const event = keyboardEvent({ key: "X", ctrlKey: true, shiftKey: true });
		expect(matchesShortcut(event, "Ctrl+Shift+X")).toBe(true);
		expect(matchesShortcut(event, "Ctrl+B")).toBe(false);
	});

	test("detects editable targets", () => {
		const input = {
			closest: () => ({}),
		};
		expect(isEditableTarget(input)).toBe(true);

		const child = {
			closest: () => null,
		};
		expect(isEditableTarget(child)).toBe(false);
	});
});
