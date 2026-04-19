import { computed, onBeforeUnmount, watch, type Ref } from "vue";
import type { ThemeMode } from "@/ui/composables/useAppPreferences";

type ResolvedTheme = "dark" | "light";

/**
 * Applies the user's preferred theme mode to the document and tracks the
 * system scheme when the mode is set to `system`.
 */
export function useThemeMode(themeMode: Ref<ThemeMode>) {
	const mediaQuery = typeof window !== "undefined"
		? window.matchMedia("(prefers-color-scheme: light)")
		: null;

	const resolvedTheme = computed<ResolvedTheme>(() => {
		if (themeMode.value === "system") {
			return mediaQuery?.matches ? "light" : "dark";
		}
		return themeMode.value;
	});

	function applyTheme() {
		if (typeof document === "undefined") return;
		document.documentElement.dataset.theme = resolvedTheme.value;
		document.documentElement.style.colorScheme = resolvedTheme.value;
	}

	const stopWatch = watch(resolvedTheme, applyTheme, { immediate: true });

	function onMediaChange() {
		if (themeMode.value === "system") applyTheme();
	}

	mediaQuery?.addEventListener("change", onMediaChange);

	onBeforeUnmount(() => {
		stopWatch();
		mediaQuery?.removeEventListener("change", onMediaChange);
	});

	return {
		resolvedTheme,
	};
}
