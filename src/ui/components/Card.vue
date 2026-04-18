<script setup lang="ts">
import { cn } from "@/ui/lib/utils";

defineProps<{
	class?: string;
}>();
</script>

<template>
	<div
		:class="cn(
			'rounded-[8px] border border-border/75 bg-card/96 text-card-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.03),0_10px_22px_hsl(0_0%_0%/0.14)]',
			$props.class,
		)"
	>
		<slot />
	</div>
</template>
