<script setup lang="ts">
defineProps<{
	side: "left" | "right";
	activeClass?: string;
}>();

const emit = defineEmits<{
	resize: [side: "left" | "right", event: PointerEvent];
	reset: [side: "left" | "right"];
}>();
</script>

<template>
	<div
		class="shell-panel-resizer"
		:class="activeClass"
		@pointerdown="emit('resize', side, $event)"
		@dblclick="emit('reset', side)"
	/>
</template>
