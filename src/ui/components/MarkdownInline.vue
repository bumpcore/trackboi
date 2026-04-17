<script setup lang="ts">
import { computed } from "vue";
import { renderInlineMarkdown } from "@/ui/lib/markdown";

const props = defineProps<{
	value: string;
	class?: string;
}>();

const html = computed(() => renderInlineMarkdown(props.value));
</script>

<template>
	<span
		class="markdown-inline"
		:class="props.class"
		v-html="html"
	/>
</template>
