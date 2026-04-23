<script setup lang="ts">
import { cn } from "@/ui/lib/utils";

const modelValue = defineModel<string>();

defineProps<{
	class?: string;
}>();
</script>

<template>
	<textarea
		v-model="modelValue"
		:class="cn(
			'flex min-h-20 w-full rounded-[2px] border border-input/70 bg-background/35 px-2.5 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
			$props.class,
		)"
	/>
</template>
