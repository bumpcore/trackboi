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
	default: "border border-primary/34 bg-primary/11 text-primary hover:border-primary/46 hover:bg-primary/16",
	secondary: "border border-border/84 bg-secondary/64 text-muted-foreground hover:border-border/96 hover:bg-secondary/82 hover:text-foreground",
	ghost: "border border-transparent bg-transparent text-muted-foreground shadow-none hover:border-border/74 hover:bg-secondary/56 hover:text-foreground",
	outline: "border border-border/84 bg-background/16 text-muted-foreground hover:border-border/96 hover:bg-secondary/68 hover:text-foreground",
	destructive: "border border-destructive/34 bg-destructive/11 text-destructive hover:border-destructive/48 hover:bg-destructive/17",
};

const sizes = {
	default: "h-[26px] px-2.5 text-[11px]",
	sm: "h-6 px-2 text-[10px]",
	icon: "h-[26px] w-[26px]",
};
</script>

<template>
	<button
		:class="cn(
			'trackboi-mono-font inline-flex items-center justify-center gap-1.25 whitespace-nowrap rounded-[2px] font-normal leading-none tracking-[-0.01em] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.03)] transition-[border-color,background-color,color,box-shadow] duration-120 [&_svg]:h-3.5 [&_svg]:w-3.5 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
			variants[props.variant],
			sizes[props.size],
			props.class,
		)"
	>
		<slot />
	</button>
</template>
