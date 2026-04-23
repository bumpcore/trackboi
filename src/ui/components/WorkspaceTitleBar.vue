<script setup lang="ts">
import { Maximize2, Minus, X } from "lucide-vue-next";
import Tooltip from "@/ui/components/Tooltip.vue";
import trackboiLogoUrl from "../../../trackboi.svg";

defineProps<{
	projectName: string;
	branchLabel: string | null;
}>();

const emit = defineEmits<{
	drag: [event: PointerEvent];
	toggleMaximize: [event: MouseEvent];
	minimize: [];
	close: [];
}>();
</script>

<template>
	<header class="relative z-10 grid h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-card/95 pl-2.5 pr-0 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border/90">
		<div
			class="flex min-w-0 items-center gap-1.5 overflow-hidden pl-2.5 pr-1 font-mono text-[10px] text-muted-foreground"
			data-electron-drag-region
			@dblclick="emit('toggleMaximize', $event)"
			@pointerdown="emit('drag', $event)"
		>
			<img :src="trackboiLogoUrl" alt="Trackboi" class="h-4 w-4 shrink-0" />
			<span class="rounded-[4px] bg-secondary/88 px-1.5 py-0.5 text-foreground">Trackboi</span>
			<span>/</span>
			<span class="truncate text-foreground">{{ projectName }}</span>
			<span
				v-if="branchLabel"
				class="shrink-0 rounded-[4px] border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-primary"
			>
				{{ branchLabel }}
			</span>
		</div>

		<div class="flex h-full min-w-0 items-stretch justify-end self-stretch pl-1" data-window-control>
			<Tooltip content="Minimize" side="bottom">
				<button
					type="button"
					class="grid h-full w-9 place-items-center text-muted-foreground transition-colors hover:bg-secondary/85 hover:text-foreground"
					@click="emit('minimize')"
				>
					<Minus class="h-3.5 w-3.5" />
				</button>
			</Tooltip>
			<Tooltip content="Maximize" side="bottom">
				<button
					type="button"
					class="grid h-full w-9 place-items-center text-muted-foreground transition-colors hover:bg-secondary/85 hover:text-foreground"
					@click="emit('toggleMaximize', $event)"
				>
					<Maximize2 class="h-3 w-3" />
				</button>
			</Tooltip>
			<Tooltip content="Close" side="bottom">
				<button
					type="button"
					class="grid h-full w-9 place-items-center text-muted-foreground transition-colors hover:bg-destructive/24 hover:text-destructive-foreground"
					@click="emit('close')"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</Tooltip>
		</div>
	</header>
</template>
