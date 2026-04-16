<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = withDefaults(
	defineProps<{
		variant?: "default" | "secondary" | "outline";
		class?: string;
	}>(),
	{
		variant: "default",
		class: "",
	},
);

const variants = {
	default: "border-transparent bg-primary text-primary-foreground",
	secondary: "border-transparent bg-secondary text-secondary-foreground",
	outline: "border-border text-foreground",
};
</script>

<template>
	<div
		:class="cn(
			'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
			variants[props.variant],
			props.class,
		)"
	>
		<slot />
	</div>
</template>

