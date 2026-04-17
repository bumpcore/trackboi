<script setup lang="ts">
import { computed } from "vue";
import { renderMarkdown } from "@/ui/lib/markdown";

const props = defineProps<{
	value: string;
	preview?: boolean;
	class?: string;
}>();

const html = computed(() => renderMarkdown(props.value));
</script>

<template>
	<div
		class="markdown-body"
		:class="[props.preview ? 'markdown-preview' : '', props.class]"
		v-html="html"
	/>
</template>
