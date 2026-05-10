<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { projectColorStyle } from "@/ui/lib/projectColor";
import { projectIconSrc } from "@/ui/lib/projectIcon";

const props = defineProps<{
	name: string;
	path: string;
	color?: string | null;
	iconPath?: string | null;
	iconClass?: string;
}>();

const imageFailed = ref(false);
const src = computed(() => projectIconSrc({ iconPath: props.iconPath }));
const initial = computed(() => props.name.slice(0, 1).toUpperCase());
const showImage = computed(() => Boolean(src.value) && !imageFailed.value);

watch(src, () => {
	imageFailed.value = false;
});
</script>

<template>
	<span
		class="grid shrink-0 place-items-center overflow-hidden rounded-[2px] bg-[var(--project-color)] font-bold text-[var(--project-fg)]"
		:class="iconClass"
		:style="projectColorStyle({ name, path, color })"
	>
		<img
			v-if="showImage && src"
			:src="src"
			:alt="`${name} icon`"
			class="h-full w-full object-cover"
			@error="imageFailed = true"
		>
		<span v-else>{{ initial }}</span>
	</span>
</template>
