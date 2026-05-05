import { onBeforeUnmount } from "vue";
import type { Ref } from "vue";
import { isEditableTarget, matchesShortcut } from "@/ui/lib/keyboardShortcuts";

type PanelShortcutOptions = {
	leftShortcut: Ref<string>;
	rightShortcut: Ref<string>;
	toggleLeftPanel: () => void;
	toggleRightPanel: () => void;
	shortcuts?: Array<{ shortcut: Ref<string>; run: () => void | Promise<void> }>;
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
			return;
		}

		for (const binding of options.shortcuts ?? []) {
			if (!matchesShortcut(event, binding.shortcut.value)) continue;
			event.preventDefault();
			void Promise.resolve(binding.run());
			return;
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
