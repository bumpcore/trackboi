<script setup lang="ts">
import { Maximize2, Minus, X } from "lucide-vue-next";
import Tooltip from "@/ui/components/Tooltip.vue";

defineProps<{
	projectName: string;
	branchLabel: string | null;
	locationLabel: string | null;
}>();

const emit = defineEmits<{
	drag: [event: PointerEvent];
	toggleMaximize: [event: MouseEvent];
	minimize: [];
	close: [];
}>();
</script>

<template>
	<header class="relative z-10 grid h-11 grid-cols-[minmax(0,max-content)_minmax(0,1fr)_auto] items-center gap-3 bg-card/95 pl-6 pr-0 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border/90">
		<div
			class="flex min-w-0 items-center gap-2 overflow-hidden pr-1 font-mono text-[11px] text-muted-foreground"
			data-electron-drag-region
			@pointerdown="emit('drag', $event)"
		>
			<span class="rounded-[4px] bg-secondary/88 px-1.5 py-0.5 text-foreground">trackboi</span>
			<span>/</span>
			<span class="truncate text-foreground">{{ projectName }}</span>
			<span
				v-if="branchLabel"
				class="shrink-0 rounded-[4px] border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-primary"
			>
				{{ branchLabel }}
			</span>
		</div>

		<div
			class="flex min-w-0 w-full max-w-[760px] items-center justify-self-center gap-2 rounded-md border border-border/80 bg-background/30 px-3 py-1.5 font-mono text-[11px] text-muted-foreground"
			data-electron-drag-region
			@dblclick="emit('toggleMaximize', $event)"
			@pointerdown="emit('drag', $event)"
		>
			<span class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">path</span>
			<span class="truncate text-foreground">{{ locationLabel ?? "local project" }}</span>
		</div>

		<div class="flex h-full items-stretch justify-end justify-self-end self-stretch" data-window-control>
			<Tooltip content="Minimize" side="bottom">
				<button
					type="button"
					class="grid h-full w-10 place-items-center text-muted-foreground transition-colors hover:bg-secondary/85 hover:text-foreground"
					@click="emit('minimize')"
				>
					<Minus class="h-4 w-4" />
				</button>
			</Tooltip>
			<Tooltip content="Maximize" side="bottom">
				<button
					type="button"
					class="grid h-full w-10 place-items-center text-muted-foreground transition-colors hover:bg-secondary/85 hover:text-foreground"
					@click="emit('toggleMaximize', $event)"
				>
					<Maximize2 class="h-3.5 w-3.5" />
				</button>
			</Tooltip>
			<Tooltip content="Close" side="bottom">
				<button
					type="button"
					class="grid h-full w-10 place-items-center text-muted-foreground transition-colors hover:bg-destructive/24 hover:text-destructive-foreground"
					@click="emit('close')"
				>
					<X class="h-4 w-4" />
				</button>
			</Tooltip>
		</div>
	</header>
</template>
