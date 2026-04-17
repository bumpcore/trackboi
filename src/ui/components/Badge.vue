<script setup lang="ts">
import { cn } from "@/ui/lib/utils";

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
	default: "border-transparent bg-primary/90 text-primary-foreground",
	secondary: "border-border/40 bg-secondary/70 text-secondary-foreground",
	outline: "border-border/55 bg-background/20 text-foreground",
};
</script>

<template>
	<div
		:class="cn(
			'inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium leading-5 transition-colors',
			variants[props.variant],
			props.class,
		)"
	>
		<slot />
	</div>
</template>
