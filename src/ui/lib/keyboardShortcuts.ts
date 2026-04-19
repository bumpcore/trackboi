const MODIFIER_ORDER = ["Ctrl", "Shift", "Alt", "Meta"] as const;
const MODIFIER_TOKENS: Record<string, (typeof MODIFIER_ORDER)[number]> = {
	ctrl: "Ctrl",
	control: "Ctrl",
	shift: "Shift",
	alt: "Alt",
	option: "Alt",
	meta: "Meta",
	cmd: "Meta",
	command: "Meta",
};

const PURE_MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function formatKeyToken(rawKey: string): string {
	const key = rawKey.trim();
	if (!key) return "";
	if (key === " ") return "Space";
	if (key.length === 1) return key.toUpperCase();

	switch (key.toLowerCase()) {
		case "escape":
			return "Escape";
		case "arrowup":
			return "ArrowUp";
		case "arrowdown":
			return "ArrowDown";
		case "arrowleft":
			return "ArrowLeft";
		case "arrowright":
			return "ArrowRight";
		default:
			return `${key[0]?.toUpperCase() ?? ""}${key.slice(1)}`;
	}
}

/**
 * Normalizes a persisted shortcut string into a stable modifier order and a
 * display-friendly key token.
 */
export function normalizeShortcut(rawShortcut: string): string | null {
	const tokens = rawShortcut
		.split("+")
		.map((token) => token.trim())
		.filter(Boolean);
	if (tokens.length === 0) return null;

	const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>();
	let key = "";

	for (const token of tokens) {
		const modifier = MODIFIER_TOKENS[token.toLowerCase()];
		if (modifier) {
			modifiers.add(modifier);
			continue;
		}
		key = formatKeyToken(token);
	}

	if (!key) return null;

	return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join("+");
}

/**
 * Converts a key event into a persisted shortcut string. Pure modifier presses
 * return null so capture UIs can ignore them cleanly.
 */
export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
	if (PURE_MODIFIER_KEYS.has(event.key)) return null;

	const parts: string[] = [];
	if (event.ctrlKey) parts.push("Ctrl");
	if (event.shiftKey) parts.push("Shift");
	if (event.altKey) parts.push("Alt");
	if (event.metaKey) parts.push("Meta");

	const key = formatKeyToken(event.key);
	if (!key) return null;

	return [...parts, key].join("+");
}

/**
 * Matches a keyboard event against a persisted shortcut string.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string | null | undefined): boolean {
	if (!shortcut) return false;
	return shortcutFromKeyboardEvent(event) === normalizeShortcut(shortcut);
}

/**
 * Global app shortcuts should not fire while the user is typing in an editable
 * control or contenteditable surface.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
	if (!target || typeof target !== "object") return false;

	const element = target as {
		isContentEditable?: boolean;
		closest?: (selector: string) => unknown;
	};

	if (element.isContentEditable) return true;
	return typeof element.closest === "function"
		&& element.closest("input, textarea, select, [contenteditable='true']") != null;
}
