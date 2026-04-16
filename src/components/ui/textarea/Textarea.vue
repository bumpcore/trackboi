<script setup lang="ts">
import { cn } from "@/lib/utils";

const modelValue = defineModel<string>();

defineProps<{
	class?: string;
}>();
</script>

<template>
	<textarea
		v-model="modelValue"
		:class="cn(
			'flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
			$props.class,
		)"
	/>
</template>
