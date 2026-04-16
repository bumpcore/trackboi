<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = withDefaults(
	defineProps<{
		variant?: "default" | "secondary" | "ghost" | "outline" | "destructive";
		size?: "default" | "sm" | "icon";
		class?: string;
	}>(),
	{
		variant: "default",
		size: "default",
		class: "",
	},
);

const variants = {
	default: "bg-primary text-primary-foreground hover:bg-primary/90",
	secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
	ghost: "hover:bg-accent hover:text-accent-foreground",
	outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
	destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizes = {
	default: "h-9 px-4 py-2",
	sm: "h-8 px-3 text-xs",
	icon: "h-8 w-8",
};
</script>

<template>
	<button
		:class="cn(
			'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
			variants[props.variant],
			sizes[props.size],
			props.class,
		)"
	>
		<slot />
	</button>
</template>

