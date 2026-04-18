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
	default: "border-primary/45 bg-primary/14 text-primary",
	secondary: "border-border/72 bg-secondary/72 text-muted-foreground",
	outline: "border-border/72 bg-background/22 text-muted-foreground",
};
</script>

<template>
	<div
		:class="cn(
			'trackboi-mono-font inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.03em] leading-none transition-colors',
			variants[props.variant],
			props.class,
		)"
	>
		<slot />
	</div>
</template>
