import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { normalizeAccentColor, type AccentColor, type ThemeMode } from "@/ui/composables/useAppPreferences";

type ResolvedTheme = "dark" | "light";
type AccentThemeTokens = {
	primary: string;
	primaryForeground: string;
	ring: string;
};

export type AccentColorOption = {
	value: AccentColor;
	label: string;
	dark: AccentThemeTokens;
	light: AccentThemeTokens;
};

export const ACCENT_COLOR_OPTIONS: AccentColorOption[] = [
	{
		value: "amber",
		label: "Amber",
		dark: { primary: "34 59% 58%", primaryForeground: "30 20% 10%", ring: "34 59% 58%" },
		light: { primary: "31 63% 46%", primaryForeground: "36 30% 98%", ring: "31 63% 46%" },
	},
	{
		value: "blue",
		label: "Blue",
		dark: { primary: "207 72% 62%", primaryForeground: "214 38% 10%", ring: "207 72% 62%" },
		light: { primary: "211 71% 43%", primaryForeground: "210 40% 98%", ring: "211 71% 43%" },
	},
	{
		value: "green",
		label: "Green",
		dark: { primary: "152 46% 50%", primaryForeground: "156 40% 9%", ring: "152 46% 50%" },
		light: { primary: "153 54% 34%", primaryForeground: "150 40% 98%", ring: "153 54% 34%" },
	},
	{
		value: "rose",
		label: "Rose",
		dark: { primary: "349 64% 63%", primaryForeground: "350 34% 10%", ring: "349 64% 63%" },
		light: { primary: "346 68% 45%", primaryForeground: "350 45% 98%", ring: "346 68% 45%" },
	},
	{
		value: "violet",
		label: "Violet",
		dark: { primary: "263 64% 66%", primaryForeground: "263 36% 11%", ring: "263 64% 66%" },
		light: { primary: "262 58% 47%", primaryForeground: "260 45% 98%", ring: "262 58% 47%" },
	},
];

function resolveAccentTokens(accentColor: AccentColor, theme: ResolvedTheme): AccentThemeTokens {
	const option = ACCENT_COLOR_OPTIONS.find((candidate) => candidate.value === accentColor) ?? ACCENT_COLOR_OPTIONS[0];
	return option[theme];
}

/**
 * Applies the user's preferred theme mode to the document and tracks the
 * system scheme when the mode is set to `system`. It also applies the selected
 * accent palette through the same root CSS variables that controls already use.
 */
export function useThemeMode(themeMode: Ref<ThemeMode>, accentColor?: Ref<AccentColor>) {
	const mediaQuery = typeof window !== "undefined"
		? window.matchMedia("(prefers-color-scheme: light)")
		: null;
	const systemPrefersLight = ref(mediaQuery?.matches ?? false);

	const resolvedTheme = computed<ResolvedTheme>(() => {
		if (themeMode.value === "system") {
			return systemPrefersLight.value ? "light" : "dark";
		}
		return themeMode.value;
	});

	function applyTheme() {
		if (typeof document === "undefined") return;
		const nextAccentColor = normalizeAccentColor(accentColor?.value);
		const accentTokens = resolveAccentTokens(nextAccentColor, resolvedTheme.value);
		document.documentElement.dataset.theme = resolvedTheme.value;
		document.documentElement.dataset.accent = nextAccentColor;
		document.documentElement.style.colorScheme = resolvedTheme.value;
		document.documentElement.style.setProperty("--primary", accentTokens.primary);
		document.documentElement.style.setProperty("--primary-foreground", accentTokens.primaryForeground);
		document.documentElement.style.setProperty("--ring", accentTokens.ring);
	}

	const stopWatch = watch([resolvedTheme, () => accentColor?.value], applyTheme, { immediate: true });

	function onMediaChange() {
		systemPrefersLight.value = mediaQuery?.matches ?? false;
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
