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
	default: "border-transparent bg-primary/90 text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.1)]",
	secondary: "border-border/45 bg-secondary/88 text-secondary-foreground",
	outline: "border-border/65 bg-background/28 text-foreground",
};
</script>

<template>
	<div
		:class="cn(
			'inline-flex items-center rounded-[6px] border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.04em] leading-5 transition-colors',
			variants[props.variant],
			props.class,
		)"
	>
		<slot />
	</div>
</template>
