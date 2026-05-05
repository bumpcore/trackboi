import { ref, watch } from "vue";
import { normalizeShortcut } from "@/ui/lib/keyboardShortcuts";

const APP_PREFERENCES_KEY = "trackboi:app-settings:v1";

export const DEFAULT_LEFT_PANEL_SHORTCUT = "Ctrl+B";
export const DEFAULT_RIGHT_PANEL_SHORTCUT = "Ctrl+Shift+X";
export const DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT = "Ctrl+P";
export const DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT = "Ctrl+Shift+P";
export const DEFAULT_OPEN_SETTINGS_SHORTCUT = "Ctrl+,";
export const DEFAULT_ADD_PROJECT_SHORTCUT = "Ctrl+O";
export const DEFAULT_NEW_CARD_SHORTCUT = "Ctrl+N";
export const DEFAULT_NEW_TRACK_SHORTCUT = "Ctrl+Shift+N";
export const DEFAULT_NEXT_PROJECT_SHORTCUT = "Ctrl+PageDown";
export const DEFAULT_PREVIOUS_PROJECT_SHORTCUT = "Ctrl+PageUp";
export const DEFAULT_PROJECT_SETTINGS_SHORTCUT = "Ctrl+Alt+,";
export const DEFAULT_BOARD_SETTINGS_SHORTCUT = "Ctrl+Alt+B";
export const DEFAULT_FOCUS_BOARD_SHORTCUT = "Ctrl+Alt+0";
export const DEFAULT_THEME_MODE = "dark";

export type ThemeMode = "dark" | "light" | "system";

type PersistedAppPreferences = {
	leftPanelShortcut: string;
	rightPanelShortcut: string;
	commandCenterNavigateShortcut: string;
	commandCenterCommandShortcut: string;
	openSettingsShortcut: string;
	addProjectShortcut: string;
	newCardShortcut: string;
	newTrackShortcut: string;
	nextProjectShortcut: string;
	previousProjectShortcut: string;
	projectSettingsShortcut: string;
	boardSettingsShortcut: string;
	focusBoardShortcut: string;
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
	const openSettingsShortcut = ref(DEFAULT_OPEN_SETTINGS_SHORTCUT);
	const addProjectShortcut = ref(DEFAULT_ADD_PROJECT_SHORTCUT);
	const newCardShortcut = ref(DEFAULT_NEW_CARD_SHORTCUT);
	const newTrackShortcut = ref(DEFAULT_NEW_TRACK_SHORTCUT);
	const nextProjectShortcut = ref(DEFAULT_NEXT_PROJECT_SHORTCUT);
	const previousProjectShortcut = ref(DEFAULT_PREVIOUS_PROJECT_SHORTCUT);
	const projectSettingsShortcut = ref(DEFAULT_PROJECT_SETTINGS_SHORTCUT);
	const boardSettingsShortcut = ref(DEFAULT_BOARD_SETTINGS_SHORTCUT);
	const focusBoardShortcut = ref(DEFAULT_FOCUS_BOARD_SHORTCUT);
	const themeMode = ref<ThemeMode>(DEFAULT_THEME_MODE);

	function defaultPreferences(): PersistedAppPreferences {
		return {
			leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
			rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
			commandCenterNavigateShortcut: DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT,
			commandCenterCommandShortcut: DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT,
			openSettingsShortcut: DEFAULT_OPEN_SETTINGS_SHORTCUT,
			addProjectShortcut: DEFAULT_ADD_PROJECT_SHORTCUT,
			newCardShortcut: DEFAULT_NEW_CARD_SHORTCUT,
			newTrackShortcut: DEFAULT_NEW_TRACK_SHORTCUT,
			nextProjectShortcut: DEFAULT_NEXT_PROJECT_SHORTCUT,
			previousProjectShortcut: DEFAULT_PREVIOUS_PROJECT_SHORTCUT,
			projectSettingsShortcut: DEFAULT_PROJECT_SETTINGS_SHORTCUT,
			boardSettingsShortcut: DEFAULT_BOARD_SETTINGS_SHORTCUT,
			focusBoardShortcut: DEFAULT_FOCUS_BOARD_SHORTCUT,
			themeMode: DEFAULT_THEME_MODE,
		};
	}

	function readPreferences(): PersistedAppPreferences {
		const defaults = defaultPreferences();
		if (typeof window === "undefined") return defaults;

		try {
			const raw = window.localStorage.getItem(APP_PREFERENCES_KEY);
			if (!raw) return defaults;

			const parsed = JSON.parse(raw) as Partial<PersistedAppPreferences>;
			return {
				leftPanelShortcut: normalizeShortcut(parsed.leftPanelShortcut ?? "") ?? defaults.leftPanelShortcut,
				rightPanelShortcut: normalizeShortcut(parsed.rightPanelShortcut ?? "") ?? defaults.rightPanelShortcut,
				commandCenterNavigateShortcut: normalizeShortcut(parsed.commandCenterNavigateShortcut ?? "") ?? defaults.commandCenterNavigateShortcut,
				commandCenterCommandShortcut: normalizeShortcut(parsed.commandCenterCommandShortcut ?? "") ?? defaults.commandCenterCommandShortcut,
				openSettingsShortcut: normalizeShortcut(parsed.openSettingsShortcut ?? "") ?? defaults.openSettingsShortcut,
				addProjectShortcut: normalizeShortcut(parsed.addProjectShortcut ?? "") ?? defaults.addProjectShortcut,
				newCardShortcut: normalizeShortcut(parsed.newCardShortcut ?? "") ?? defaults.newCardShortcut,
				newTrackShortcut: normalizeShortcut(parsed.newTrackShortcut ?? "") ?? defaults.newTrackShortcut,
				nextProjectShortcut: normalizeShortcut(parsed.nextProjectShortcut ?? "") ?? defaults.nextProjectShortcut,
				previousProjectShortcut: normalizeShortcut(parsed.previousProjectShortcut ?? "") ?? defaults.previousProjectShortcut,
				projectSettingsShortcut: normalizeShortcut(parsed.projectSettingsShortcut ?? "") ?? defaults.projectSettingsShortcut,
				boardSettingsShortcut: normalizeShortcut(parsed.boardSettingsShortcut ?? "") ?? defaults.boardSettingsShortcut,
				focusBoardShortcut: normalizeShortcut(parsed.focusBoardShortcut ?? "") ?? defaults.focusBoardShortcut,
				themeMode: normalizeThemeMode(parsed.themeMode),
			};
		} catch {
			return defaults;
		}
	}

	function writePreferences() {
		if (typeof window === "undefined") return;
		const payload: PersistedAppPreferences = {
			leftPanelShortcut: normalizeShortcut(leftPanelShortcut.value) ?? DEFAULT_LEFT_PANEL_SHORTCUT,
			rightPanelShortcut: normalizeShortcut(rightPanelShortcut.value) ?? DEFAULT_RIGHT_PANEL_SHORTCUT,
			commandCenterNavigateShortcut: normalizeShortcut(commandCenterNavigateShortcut.value) ?? DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT,
			commandCenterCommandShortcut: normalizeShortcut(commandCenterCommandShortcut.value) ?? DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT,
			openSettingsShortcut: normalizeShortcut(openSettingsShortcut.value) ?? DEFAULT_OPEN_SETTINGS_SHORTCUT,
			addProjectShortcut: normalizeShortcut(addProjectShortcut.value) ?? DEFAULT_ADD_PROJECT_SHORTCUT,
			newCardShortcut: normalizeShortcut(newCardShortcut.value) ?? DEFAULT_NEW_CARD_SHORTCUT,
			newTrackShortcut: normalizeShortcut(newTrackShortcut.value) ?? DEFAULT_NEW_TRACK_SHORTCUT,
			nextProjectShortcut: normalizeShortcut(nextProjectShortcut.value) ?? DEFAULT_NEXT_PROJECT_SHORTCUT,
			previousProjectShortcut: normalizeShortcut(previousProjectShortcut.value) ?? DEFAULT_PREVIOUS_PROJECT_SHORTCUT,
			projectSettingsShortcut: normalizeShortcut(projectSettingsShortcut.value) ?? DEFAULT_PROJECT_SETTINGS_SHORTCUT,
			boardSettingsShortcut: normalizeShortcut(boardSettingsShortcut.value) ?? DEFAULT_BOARD_SETTINGS_SHORTCUT,
			focusBoardShortcut: normalizeShortcut(focusBoardShortcut.value) ?? DEFAULT_FOCUS_BOARD_SHORTCUT,
			themeMode: normalizeThemeMode(themeMode.value),
		};
		window.localStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(payload));
	}

	function resetPanelShortcuts() {
		leftPanelShortcut.value = DEFAULT_LEFT_PANEL_SHORTCUT;
		rightPanelShortcut.value = DEFAULT_RIGHT_PANEL_SHORTCUT;
		commandCenterNavigateShortcut.value = DEFAULT_COMMAND_CENTER_NAVIGATE_SHORTCUT;
		commandCenterCommandShortcut.value = DEFAULT_COMMAND_CENTER_COMMAND_SHORTCUT;
		openSettingsShortcut.value = DEFAULT_OPEN_SETTINGS_SHORTCUT;
		addProjectShortcut.value = DEFAULT_ADD_PROJECT_SHORTCUT;
		newCardShortcut.value = DEFAULT_NEW_CARD_SHORTCUT;
		newTrackShortcut.value = DEFAULT_NEW_TRACK_SHORTCUT;
		nextProjectShortcut.value = DEFAULT_NEXT_PROJECT_SHORTCUT;
		previousProjectShortcut.value = DEFAULT_PREVIOUS_PROJECT_SHORTCUT;
		projectSettingsShortcut.value = DEFAULT_PROJECT_SETTINGS_SHORTCUT;
		boardSettingsShortcut.value = DEFAULT_BOARD_SETTINGS_SHORTCUT;
		focusBoardShortcut.value = DEFAULT_FOCUS_BOARD_SHORTCUT;
	}

	function resetThemeMode() {
		themeMode.value = DEFAULT_THEME_MODE;
	}

	const persisted = readPreferences();
	leftPanelShortcut.value = persisted.leftPanelShortcut;
	rightPanelShortcut.value = persisted.rightPanelShortcut;
	commandCenterNavigateShortcut.value = persisted.commandCenterNavigateShortcut;
	commandCenterCommandShortcut.value = persisted.commandCenterCommandShortcut;
	openSettingsShortcut.value = persisted.openSettingsShortcut;
	addProjectShortcut.value = persisted.addProjectShortcut;
	newCardShortcut.value = persisted.newCardShortcut;
	newTrackShortcut.value = persisted.newTrackShortcut;
	nextProjectShortcut.value = persisted.nextProjectShortcut;
	previousProjectShortcut.value = persisted.previousProjectShortcut;
	projectSettingsShortcut.value = persisted.projectSettingsShortcut;
	boardSettingsShortcut.value = persisted.boardSettingsShortcut;
	focusBoardShortcut.value = persisted.focusBoardShortcut;
	themeMode.value = persisted.themeMode;

	watch([
		leftPanelShortcut,
		rightPanelShortcut,
		commandCenterNavigateShortcut,
		commandCenterCommandShortcut,
		openSettingsShortcut,
		addProjectShortcut,
		newCardShortcut,
		newTrackShortcut,
		nextProjectShortcut,
		previousProjectShortcut,
		projectSettingsShortcut,
		boardSettingsShortcut,
		focusBoardShortcut,
		themeMode,
	], () => {
		writePreferences();
	});

	return {
		leftPanelShortcut,
		rightPanelShortcut,
		commandCenterNavigateShortcut,
		commandCenterCommandShortcut,
		openSettingsShortcut,
		addProjectShortcut,
		newCardShortcut,
		newTrackShortcut,
		nextProjectShortcut,
		previousProjectShortcut,
		projectSettingsShortcut,
		boardSettingsShortcut,
		focusBoardShortcut,
		themeMode,
		resetPanelShortcuts,
		resetThemeMode,
	};
}
