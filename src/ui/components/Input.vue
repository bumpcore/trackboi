<script setup lang="ts">
import { cn } from "@/ui/lib/utils";

const modelValue = defineModel<string | number>();

defineProps<{
	class?: string;
}>();
</script>

<template>
	<input
		v-model="modelValue"
		:class="cn(
			'flex h-8 w-full rounded-md border border-input/70 bg-background/35 px-2.5 py-1 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
			$props.class,
		)"
	>
</template>
