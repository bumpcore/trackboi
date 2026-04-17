<script setup lang="ts">
import { GitBranch, Maximize2, Minus, X } from "lucide-vue-next";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import Tooltip from "@/ui/components/Tooltip.vue";

defineProps<{
	title: string;
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
	<header
		class="grid h-9 grid-cols-[58px_minmax(0,1fr)_112px] border-b border-border/55 bg-card/90"
	>
		<div class="border-r border-border/55" data-electron-drag-region @pointerdown="emit('drag', $event)" />
		<div
			class="flex items-center justify-between px-4"
			data-electron-drag-region
			@dblclick="emit('toggleMaximize', $event)"
			@pointerdown="emit('drag', $event)"
		>
			<div class="min-w-0">
				<span class="block truncate text-xs font-semibold text-foreground">
					{{ title }}
				</span>
			</div>
			<div class="flex items-center gap-2" data-window-control>
				<Badge v-if="branchLabel" variant="outline" class="max-w-48 gap-1.5">
					<GitBranch class="h-3 w-3 shrink-0" />
					<span class="truncate">{{ branchLabel }}</span>
				</Badge>
			</div>
		</div>
		<div class="flex items-center justify-end border-l border-border/55 px-1" data-window-control>
			<Tooltip content="Minimize" side="bottom">
				<Button variant="ghost" size="icon" type="button" @click="emit('minimize')">
					<Minus class="h-4 w-4" />
				</Button>
			</Tooltip>
			<Tooltip content="Maximize" side="bottom">
				<Button variant="ghost" size="icon" type="button" @click="emit('toggleMaximize', $event)">
					<Maximize2 class="h-3.5 w-3.5" />
				</Button>
			</Tooltip>
			<Tooltip content="Close" side="bottom">
				<Button variant="ghost" size="icon" type="button" @click="emit('close')">
					<X class="h-4 w-4" />
				</Button>
			</Tooltip>
		</div>
	</header>
</template>
