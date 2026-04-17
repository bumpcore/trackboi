<script setup lang="ts">
import { cn } from "@/ui/lib/utils";

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
	default: "bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.14)] hover:bg-primary/90",
	secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
	ghost: "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
	outline: "border border-border/70 bg-background/35 text-foreground hover:border-border hover:bg-accent/70",
	destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizes = {
	default: "h-8 px-3 py-1.5",
	sm: "h-7 px-2.5 text-xs",
	icon: "h-7 w-7",
};
</script>

<template>
	<button
		:class="cn(
			'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
			variants[props.variant],
			sizes[props.size],
			props.class,
		)"
	>
		<slot />
	</button>
</template>
