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
	default: "border border-primary/40 bg-primary/12 text-primary hover:border-primary/55 hover:bg-primary/18",
	secondary: "border border-border/75 bg-secondary/76 text-muted-foreground hover:border-border/90 hover:bg-secondary/88 hover:text-foreground",
	ghost: "border border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/72 hover:text-foreground",
	outline: "border border-border/75 bg-background/24 text-muted-foreground hover:border-border/95 hover:bg-accent/76 hover:text-foreground",
	destructive: "border border-destructive/40 bg-destructive/14 text-destructive hover:border-destructive/60 hover:bg-destructive/22",
};

const sizes = {
	default: "h-7 px-2.5 text-[11px]",
	sm: "h-6 px-2 text-[10px]",
	icon: "h-7 w-7",
};
</script>

<template>
	<button
		:class="cn(
			'trackboi-mono-font inline-flex items-center justify-center gap-1.25 whitespace-nowrap rounded-[4px] leading-none tracking-[0.01em] transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
			variants[props.variant],
			sizes[props.size],
			props.class,
		)"
	>
		<slot />
	</button>
</template>
