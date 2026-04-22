import { ref, watch } from "vue";
import { normalizeShortcut } from "@/ui/lib/keyboardShortcuts";

const APP_PREFERENCES_KEY = "trackboi:app-settings:v1";

export const DEFAULT_LEFT_PANEL_SHORTCUT = "Ctrl+B";
export const DEFAULT_RIGHT_PANEL_SHORTCUT = "Ctrl+Shift+X";
export const DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT = "Ctrl+P";
export const DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT = "Ctrl+Shift+P";
export const DEFAULT_THEME_MODE = "dark";

export type ThemeMode = "dark" | "light" | "system";

type PersistedAppPreferences = {
	leftPanelShortcut: string;
	rightPanelShortcut: string;
	commandCenterNavigateShortcut: string;
	commandCenterCommandShortcut: string;
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
	const commandCenterNavigateShortcut = ref(DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT);
	const commandCenterCommandShortcut = ref(DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT);
	const themeMode = ref<ThemeMode>(DEFAULT_THEME_MODE);

	function readPreferences(): PersistedAppPreferences {
		if (typeof window === "undefined") {
			return {
				leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
				commandCenterNavigateShortcut: DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT,
				commandCenterCommandShortcut: DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT,
				themeMode: DEFAULT_THEME_MODE,
			};
		}

		try {
			const raw = window.localStorage.getItem(APP_PREFERENCES_KEY);
			if (!raw) {
				return {
					leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
					rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
					commandCenterNavigateShortcut: DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT,
					commandCenterCommandShortcut: DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT,
					themeMode: DEFAULT_THEME_MODE,
				};
			}

			const parsed = JSON.parse(raw) as Partial<PersistedAppPreferences>;
			return {
				leftPanelShortcut: normalizeShortcut(parsed.leftPanelShortcut ?? "") ?? DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: normalizeShortcut(parsed.rightPanelShortcut ?? "") ?? DEFAULT_RIGHT_PANEL_SHORTCUT,
				commandCenterNavigateShortcut: normalizeShortcut(parsed.commandCenterNavigateShortcut ?? "") ?? DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT,
				commandCenterCommandShortcut: normalizeShortcut(parsed.commandCenterCommandShortcut ?? "") ?? DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT,
				themeMode: normalizeThemeMode(parsed.themeMode),
			};
		} catch {
			return {
				leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
				commandCenterNavigateShortcut: DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT,
				commandCenterCommandShortcut: DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT,
				themeMode: DEFAULT_THEME_MODE,
			};
		}
	}

	function writePreferences() {
		if (typeof window === "undefined") return;
		const payload: PersistedAppPreferences = {
			leftPanelShortcut: normalizeShortcut(leftPanelShortcut.value) ?? DEFAULT_LEFT_PANEL_SHORTCUT,
			rightPanelShortcut: normalizeShortcut(rightPanelShortcut.value) ?? DEFAULT_RIGHT_PANEL_SHORTCUT,
			commandCenterNavigateShortcut: normalizeShortcut(commandCenterNavigateShortcut.value) ?? DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT,
			commandCenterCommandShortcut: normalizeShortcut(commandCenterCommandShortcut.value) ?? DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT,
			themeMode: normalizeThemeMode(themeMode.value),
		};
		window.localStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(payload));
	}

	function resetPanelShortcuts() {
		leftPanelShortcut.value = DEFAULT_LEFT_PANEL_SHORTCUT;
		rightPanelShortcut.value = DEFAULT_RIGHT_PANEL_SHORTCUT;
		commandCenterNavigateShortcut.value = DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT;
		commandCenterCommandShortcut.value = DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT;
	}

	function resetThemeMode() {
		themeMode.value = DEFAULT_THEME_MODE;
	}

	const persisted = readPreferences();
	leftPanelShortcut.value = persisted.leftPanelShortcut;
	rightPanelShortcut.value = persisted.rightPanelShortcut;
	commandCenterNavigateShortcut.value = persisted.commandCenterNavigateShortcut;
	commandCenterCommandShortcut.value = persisted.commandCenterCommandShortcut;
	themeMode.value = persisted.themeMode;

	watch([leftPanelShortcut, rightPanelShortcut, commandCenterNavigateShortcut, commandCenterCommandShortcut, themeMode], () => {
		writePreferences();
	});

	return {
		leftPanelShortcut,
		rightPanelShortcut,
		commandCenterNavigateShortcut,
		commandCenterCommandShortcut,
		themeMode,
		resetPanelShortcuts,
		resetThemeMode,
	};
}
