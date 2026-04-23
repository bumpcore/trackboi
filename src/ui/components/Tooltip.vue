<script setup lang="ts">
import { computed, ref } from "vue";
import {
	autoUpdate,
	flip,
	offset,
	shift,
	useFloating,
} from "@floating-ui/vue";
import type { Placement } from "@floating-ui/vue";

const props = withDefaults(
	defineProps<{
		content: string;
		side?: "top" | "right" | "bottom" | "left";
		wrapperClass?: string;
	}>(),
	{
		side: "right",
		wrapperClass: "",
	},
);

const open = ref(false);
const reference = ref<HTMLElement | null>(null);
const floating = ref<HTMLElement | null>(null);

const placement = computed<Placement>(() => props.side);

const { floatingStyles } = useFloating(reference, floating, {
	open,
	placement,
	whileElementsMounted: autoUpdate,
	middleware: [offset(8), flip(), shift({ padding: 8 })],
});

let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
	if (openTimer) clearTimeout(openTimer);
	if (closeTimer) clearTimeout(closeTimer);
	openTimer = null;
	closeTimer = null;
}

function showTooltip() {
	if (closeTimer) clearTimeout(closeTimer);
	openTimer = setTimeout(() => {
		open.value = true;
		openTimer = null;
	}, 120);
}

function hideTooltip() {
	if (openTimer) clearTimeout(openTimer);
	closeTimer = setTimeout(() => {
		open.value = false;
		closeTimer = null;
	}, 60);
}
</script>

<template>
	<span
		ref="reference"
		class="inline-flex"
		:class="wrapperClass"
		:aria-label="content"
		@mouseenter="showTooltip"
		@mouseleave="hideTooltip"
		@focusin="showTooltip"
		@focusout="hideTooltip"
	>
		<slot />
	</span>

	<Teleport to="body">
		<div
			v-if="open"
			ref="floating"
			class="pointer-events-none z-50 max-w-64 whitespace-nowrap rounded-[2px] border border-border/70 bg-popover/96 px-2 py-1 text-xs font-medium text-popover-foreground shadow-xl backdrop-blur-sm"
			:style="floatingStyles"
			role="tooltip"
			@mouseenter="clearTimers"
			@mouseleave="hideTooltip"
		>
			{{ content }}
		</div>
	</Teleport>
</template>
