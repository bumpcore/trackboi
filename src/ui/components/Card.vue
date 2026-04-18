<script setup lang="ts">
import { cn } from "@/ui/lib/utils";

defineProps<{
	class?: string;
}>();
</script>

<template>
	<div
		:class="cn(
			'rounded-[10px] border border-border/75 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--card)/0.96)_100%)] text-card-foreground shadow-[0_1px_0_hsl(0_0%_100%/0.03),0_10px_24px_hsl(0_0%_0%/0.18)]',
			$props.class,
		)"
	>
		<slot />
	</div>
</template>
