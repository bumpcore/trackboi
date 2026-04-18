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
			'flex h-8 w-full rounded-[5px] border border-input/82 bg-secondary/72 px-2.5 py-1 text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-colors placeholder:text-muted-foreground focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-secondary/88 disabled:cursor-not-allowed disabled:opacity-50',
			$props.class,
		)"
	>
</template>
