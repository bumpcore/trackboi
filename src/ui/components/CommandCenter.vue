<script setup lang="ts">
import {
	ArrowLeftToLine,
	ArrowRightToLine,
	Cog,
	FilePlus2,
	FileText,
	Folders,
	GitBranch,
	LayoutGrid,
	Minimize2,
	MessageSquareText,
	Plus,
	Settings2,
	SquareDashedMousePointer,
	SquareTerminal,
	X,
	Workflow,
} from "lucide-vue-next";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { Component } from "vue";
import type { CommandCenterItem, CommandCenterItemKind, CommandCenterMode } from "@/ui/viewTypes";

const props = defineProps<{
	open: boolean;
	mode: CommandCenterMode;
	query: string;
	items: CommandCenterItem[];
	selectedIndex: number;
}>();

const emit = defineEmits<{
	close: [];
	updateQuery: [value: string];
	moveSelection: [delta: number];
	selectActive: [];
	selectIndex: [index: number];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const itemRefs = ref<Array<HTMLButtonElement | null>>([]);

const kindIcons: Record<CommandCenterItemKind, Component> = {
	project: Folders,
	worktree: GitBranch,
	board: LayoutGrid,
	track: Workflow,
	card: FileText,
	comment: MessageSquareText,
	command: SquareTerminal,
};

const commandIcons: Record<string, Component> = {
	settings: Cog,
	chooseProject: Plus,
	createCard: FilePlus2,
	createTrack: Workflow,
	toggleLeftPanel: ArrowLeftToLine,
	toggleRightPanel: ArrowRightToLine,
	rightCard: FileText,
	rightTrack: Workflow,
	rightActivity: SquareDashedMousePointer,
	rightContext: Settings2,
	minimizeWindow: Minimize2,
	maximizeWindow: LayoutGrid,
	closeWindow: X,
	projectSettings: Settings2,
	boardSettings: LayoutGrid,
};

function focusInput() {
	void nextTick(() => {
		inputRef.value?.focus();
		inputRef.value?.select();
	});
}

function setItemRef(element: HTMLButtonElement | null, index: number) {
	itemRefs.value[index] = element;
}

function iconForItem(item: CommandCenterItem): Component {
	if (item.icon && item.icon in commandIcons) return commandIcons[item.icon];
	return kindIcons[item.kind];
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		event.preventDefault();
		emit("close");
		return;
	}

	if (event.key === "ArrowDown") {
		event.preventDefault();
		emit("moveSelection", 1);
		return;
	}

	if (event.key === "ArrowUp") {
		event.preventDefault();
		emit("moveSelection", -1);
		return;
	}

	if (event.key === "Enter") {
		event.preventDefault();
		emit("selectActive");
	}
}

watch(
	() => props.open,
	(open) => {
		if (open) focusInput();
	},
	{ immediate: true },
);

watch(
	() => props.selectedIndex,
	(index) => {
		const element = itemRefs.value[index];
		element?.scrollIntoView({ block: "nearest" });
	},
);

watch(
	() => props.items.length,
	() => {
		itemRefs.value = [];
	},
);

watch(
	() => props.open,
	(open) => {
		if (typeof window === "undefined") return;
		if (open) window.addEventListener("keydown", handleKeyDown);
		else window.removeEventListener("keydown", handleKeyDown);
	},
	{ immediate: true },
);

onBeforeUnmount(() => {
	if (typeof window !== "undefined") {
		window.removeEventListener("keydown", handleKeyDown);
	}
});
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-0 z-40 grid place-items-start justify-items-center px-4 pt-7"
			data-testid="command-center"
			@pointerdown.self="emit('close')"
		>
			<section class="grid w-[min(620px,92vw)] overflow-hidden rounded-[2px] border border-border/80 bg-[hsl(var(--background)/0.985)] shadow-[0_12px_34px_hsl(0_0%_0%/0.22)]">
				<header class="border-b border-border/45 px-3 py-2.5">
					<div class="flex items-center gap-2 rounded-[2px] border border-input/70 bg-[hsl(var(--card)/0.6)] px-2.5 py-1.5">
						<input
							ref="inputRef"
							:value="query"
							class="trackboi-mono-font h-4 w-full border-0 bg-transparent p-0 text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
							placeholder=""
							autocapitalize="off"
							autocomplete="off"
							autocorrect="off"
							spellcheck="false"
							@input="emit('updateQuery', ($event.target as HTMLInputElement).value)"
						>
					</div>
				</header>

				<div class="command-center-scrollbar max-h-[min(56vh,520px)] overflow-x-hidden overflow-y-auto px-1.5 py-1.5">
					<div v-if="items.length === 0" class="px-4 py-7 text-center">
						<p class="text-sm font-medium text-foreground">No matches yet.</p>
						<p class="mt-1 text-sm text-muted-foreground">
							{{ mode === "command" ? "Try a different command query." : "Try a workspace, worktree, card, or comment." }}
						</p>
					</div>

					<div v-else class="grid gap-1">
						<template v-for="(item, index) in items" :key="item.id">
							<button
								:ref="(element) => setItemRef(element as HTMLButtonElement | null, index)"
								type="button"
								class="flex min-w-0 w-full items-start gap-2.5 rounded-[2px] px-2.5 py-1.5 text-left transition-colors"
								:class="index === selectedIndex
									? 'bg-accent/52 text-foreground'
									: 'text-foreground hover:bg-accent/24'"
								@click="emit('selectIndex', index); emit('selectActive')"
								@pointermove="emit('selectIndex', index)"
							>
								<component
									:is="iconForItem(item)"
									class="mt-[1px] h-3.5 w-3.5 shrink-0"
									:class="index === selectedIndex ? 'text-primary' : 'text-muted-foreground/82'"
								/>

								<div class="min-w-0">
									<div class="truncate text-[13px] font-medium text-foreground">{{ item.title }}</div>
									<p v-if="item.subtitle" class="mt-0.5 truncate text-[12px] leading-5 text-muted-foreground">{{ item.subtitle }}</p>
								</div>
							</button>
						</template>
					</div>
				</div>
			</section>
		</div>
	</Transition>
</template>
