import Fuse from "fuse.js";
import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from "vue";
import { isEditableTarget, matchesShortcut } from "@/ui/lib/keyboardShortcuts";
import type { CommandCenterItem, CommandCenterMode } from "@/ui/viewTypes";
import type { IFuseOptions } from "fuse.js";

type CommandCenterOptions = {
	navigateShortcut: Ref<string>;
	commandShortcut: Ref<string>;
	items: ComputedRef<CommandCenterItem[]>;
};

type CommandCenterState = {
	open: Ref<boolean>;
	query: Ref<string>;
	selectedIndex: Ref<number>;
	activeMode: ComputedRef<CommandCenterMode>;
	filteredItems: ComputedRef<CommandCenterItem[]>;
	openNavigate(): void;
	openCommand(): void;
	close(): void;
	setQuery(value: string): void;
	moveSelection(delta: number): void;
	selectActive(): void;
	selectIndex(index: number): void;
};

const FUSE_OPTIONS: IFuseOptions<CommandCenterItem> = {
	ignoreLocation: true,
	includeScore: true,
	shouldSort: true,
	threshold: 0.34,
	minMatchCharLength: 2,
	keys: [
		{ name: "title", weight: 0.5 },
		{ name: "keywords", weight: 0.25 },
		{ name: "subtitle", weight: 0.15 },
		{ name: "section", weight: 0.07 },
		{ name: "kind", weight: 0.03 },
	],
};

/**
 * Owns the desktop command-center workflow, including open state, mode
 * switching, keyboard shortcuts, filtering, and active selection management.
 */
export function useCommandCenter(options: CommandCenterOptions): CommandCenterState {
	const open = ref(false);
	const query = ref("");
	const selectedIndex = ref(0);
	const requestedMode = ref<CommandCenterMode>("navigate");

	const activeMode = computed<CommandCenterMode>(() => (
		query.value.trimStart().startsWith(">") ? "command" : requestedMode.value
	));
	const searchQuery = computed(() => (
		activeMode.value === "command"
			? query.value.trimStart().replace(/^>\s*/, "").trim()
			: query.value.trim()
	));
	const scopedItems = computed(() => (
		options.items.value.filter((item) => item.mode === activeMode.value)
	));
	const filteredItems = computed(() => {
		if (!searchQuery.value) return scopedItems.value;

		const fuse = new Fuse(scopedItems.value, FUSE_OPTIONS);
		return fuse.search(searchQuery.value).map((result) => result.item);
	});

	function openWithMode(mode: CommandCenterMode) {
		requestedMode.value = mode;
		query.value = mode === "command" ? ">" : "";
		selectedIndex.value = 0;
		open.value = true;
	}

	function openNavigate() {
		openWithMode("navigate");
	}

	function openCommand() {
		openWithMode("command");
	}

	function close() {
		open.value = false;
		query.value = "";
		selectedIndex.value = 0;
		requestedMode.value = "navigate";
	}

	function setQuery(value: string) {
		query.value = value;
	}

	function moveSelection(delta: number) {
		const count = filteredItems.value.length;
		if (count === 0) return;

		selectedIndex.value = (selectedIndex.value + delta + count) % count;
	}

	function selectActive() {
		const item = filteredItems.value[selectedIndex.value];
		if (!item) return;
		close();
		void Promise.resolve(item.run());
	}

	function selectIndex(index: number) {
		selectedIndex.value = index;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.defaultPrevented || isEditableTarget(event.target)) return;

		if (matchesShortcut(event, options.navigateShortcut.value)) {
			event.preventDefault();
			openNavigate();
			return;
		}

		if (matchesShortcut(event, options.commandShortcut.value)) {
			event.preventDefault();
			openCommand();
		}
	}

	watch([query, activeMode], () => {
		selectedIndex.value = 0;
	});

	watch(filteredItems, (items) => {
		if (items.length === 0) {
			selectedIndex.value = 0;
			return;
		}

		if (selectedIndex.value >= items.length) selectedIndex.value = items.length - 1;
	});

	if (typeof window !== "undefined") {
		window.addEventListener("keydown", handleKeyDown);
	}

	onBeforeUnmount(() => {
		if (typeof window !== "undefined") {
			window.removeEventListener("keydown", handleKeyDown);
		}
	});

	return {
		open,
		query,
		selectedIndex,
		activeMode,
		filteredItems,
		openNavigate,
		openCommand,
		close,
		setQuery,
		moveSelection,
		selectActive,
		selectIndex,
	};
}
