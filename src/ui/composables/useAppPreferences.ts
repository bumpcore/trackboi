import { ref, watch } from "vue";
import { normalizeShortcut } from "@/ui/lib/keyboardShortcuts";

const APP_PREFERENCES_KEY = "trackboi:app-settings:v1";

export const DEFAULT_LEFT_PANEL_SHORTCUT = "Ctrl+B";
export const DEFAULT_RIGHT_PANEL_SHORTCUT = "Ctrl+Shift+X";

type PersistedAppPreferences = {
	leftPanelShortcut: string;
	rightPanelShortcut: string;
};

/**
 * Owns renderer-local app preferences that are not part of repo/project data.
 * These settings follow the user across projects on the same machine.
 */
export function useAppPreferences() {
	const leftPanelShortcut = ref(DEFAULT_LEFT_PANEL_SHORTCUT);
	const rightPanelShortcut = ref(DEFAULT_RIGHT_PANEL_SHORTCUT);

	function readPreferences(): PersistedAppPreferences {
		if (typeof window === "undefined") {
			return {
				leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
			};
		}

		try {
			const raw = window.localStorage.getItem(APP_PREFERENCES_KEY);
			if (!raw) {
				return {
					leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
					rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
				};
			}

			const parsed = JSON.parse(raw) as Partial<PersistedAppPreferences>;
			return {
				leftPanelShortcut: normalizeShortcut(parsed.leftPanelShortcut ?? "") ?? DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: normalizeShortcut(parsed.rightPanelShortcut ?? "") ?? DEFAULT_RIGHT_PANEL_SHORTCUT,
			};
		} catch {
			return {
				leftPanelShortcut: DEFAULT_LEFT_PANEL_SHORTCUT,
				rightPanelShortcut: DEFAULT_RIGHT_PANEL_SHORTCUT,
			};
		}
	}

	function writePreferences() {
		if (typeof window === "undefined") return;
		const payload: PersistedAppPreferences = {
			leftPanelShortcut: normalizeShortcut(leftPanelShortcut.value) ?? DEFAULT_LEFT_PANEL_SHORTCUT,
			rightPanelShortcut: normalizeShortcut(rightPanelShortcut.value) ?? DEFAULT_RIGHT_PANEL_SHORTCUT,
		};
		window.localStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(payload));
	}

	function resetPanelShortcuts() {
		leftPanelShortcut.value = DEFAULT_LEFT_PANEL_SHORTCUT;
		rightPanelShortcut.value = DEFAULT_RIGHT_PANEL_SHORTCUT;
	}

	const persisted = readPreferences();
	leftPanelShortcut.value = persisted.leftPanelShortcut;
	rightPanelShortcut.value = persisted.rightPanelShortcut;

	watch([leftPanelShortcut, rightPanelShortcut], () => {
		writePreferences();
	});

	return {
		leftPanelShortcut,
		rightPanelShortcut,
		resetPanelShortcuts,
	};
}
