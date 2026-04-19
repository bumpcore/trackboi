import { onBeforeUnmount } from "vue";
import type { Ref } from "vue";
import { isEditableTarget, matchesShortcut } from "@/ui/lib/keyboardShortcuts";

type PanelShortcutOptions = {
	leftShortcut: Ref<string>;
	rightShortcut: Ref<string>;
	toggleLeftPanel: () => void;
	toggleRightPanel: () => void;
};

/**
 * Registers global shell shortcuts for the side panels while staying out of
 * the user's way during text entry.
 */
export function usePanelShortcuts(options: PanelShortcutOptions) {
	function onKeyDown(event: KeyboardEvent) {
		if (event.defaultPrevented || isEditableTarget(event.target)) return;

		if (matchesShortcut(event, options.leftShortcut.value)) {
			event.preventDefault();
			options.toggleLeftPanel();
			return;
		}

		if (matchesShortcut(event, options.rightShortcut.value)) {
			event.preventDefault();
			options.toggleRightPanel();
		}
	}

	if (typeof window !== "undefined") {
		window.addEventListener("keydown", onKeyDown);
	}

	onBeforeUnmount(() => {
		if (typeof window !== "undefined") {
			window.removeEventListener("keydown", onKeyDown);
		}
	});
}
