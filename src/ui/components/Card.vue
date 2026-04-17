<script setup lang="ts">
import { cn } from "@/ui/lib/utils";

defineProps<{
	class?: string;
}>();
</script>

<template>
	<div
		:class="cn(
			'rounded-md border border-border/65 bg-card text-card-foreground',
			$props.class,
		)"
	>
		<slot />
	</div>
</template>
