import { ref, watch } from "vue";
import { normalizeShortcut } from "@/ui/lib/keyboardShortcuts";

const APP_PREFERENCES_KEY = "trackboi:app-settings:v1";

export const DEFAULT_LEFT_PANEL_SHORTCUT = "Ctrl+B";
export const DEFAULT_RIGHT_PANEL_SHORTCUT = "Ctrl+Shift+X";
export const DEFAULT_THEME_MODE = "dark";

export type ThemeMode = "dark" | "light" | "system";

type PersistedAppPreferences = {
	leftPanelShortcut: string;
	rightPanelShortcut: string;
	themeMode: ThemeMode;
};

function normalizeThemeMode(value: unknown): ThemeMode {
	return value === "light" || value === "system" ? value : "dark";
}

/**
 * Owns renderer-local app preferences that are not part of repo/project data.
 * These settings follow the user across projects on the same machine.
 */
export function useAppPreferences() {
	const leftPanelShortcut = ref(DEFAULT_LEFT_PANEL_SHORTCUT);
	const rightPanelShortcut = ref(DEFAULT_RIGHT_PANEL_SHORTCUT);
	const themeMode = ref<ThemeMode>(DEFAULT_THEME_MODE);

	function readPreferences(): PersistedAppPreferences {
		if (typeof window === "undefined") {
			return {
				leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
				themeMode: DEFAULT_THEME_MODE,
			};
		}

		try {
			const raw = window.localStorage.getItem(APP_PREFERENCES_KEY);
			if (!raw) {
				return {
					leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
					rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
					themeMode: DEFAULT_THEME_MODE,
				};
			}

			const parsed = JSON.parse(raw) as Partial<PersistedAppPreferences>;
			return {
				leftPanelShortcut: normalizeShortcut(parsed.leftPanelShortcut ?? "") ?? DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: normalizeShortcut(parsed.rightPanelShortcut ?? "") ?? DEFAULT_RIGHT_PANEL_SHORTCUT,
				themeMode: normalizeThemeMode(parsed.themeMode),
			};
		} catch {
			return {
				leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
				themeMode: DEFAULT_THEME_MODE,
			};
		}
	}

	function writePreferences() {
		if (typeof window === "undefined") return;
		const payload: PersistedAppPreferences = {
			leftPanelShortcut: normalizeShortcut(leftPanelShortcut.value) ?? DEFAULT_LEFT_PANEL_SHORTCUT,
			rightPanelShortcut: normalizeShortcut(rightPanelShortcut.value) ?? DEFAULT_RIGHT_PANEL_SHORTCUT,
			themeMode: normalizeThemeMode(themeMode.value),
		};
		window.localStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(payload));
	}

	function resetPanelShortcuts() {
		leftPanelShortcut.value = DEFAULT_LEFT_PANEL_SHORTCUT;
		rightPanelShortcut.value = DEFAULT_RIGHT_PANEL_SHORTCUT;
	}

	function resetThemeMode() {
		themeMode.value = DEFAULT_THEME_MODE;
	}

	const persisted = readPreferences();
	leftPanelShortcut.value = persisted.leftPanelShortcut;
	rightPanelShortcut.value = persisted.rightPanelShortcut;
	themeMode.value = persisted.themeMode;

	watch([leftPanelShortcut, rightPanelShortcut, themeMode], () => {
		writePreferences();
	});

	return {
		leftPanelShortcut,
		rightPanelShortcut,
		themeMode,
		resetPanelShortcuts,
		resetThemeMode,
	};
}
