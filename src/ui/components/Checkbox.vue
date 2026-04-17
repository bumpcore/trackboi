<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import { cn } from "@/ui/lib/utils";

const modelValue = defineModel<boolean>({ default: false });

defineProps<{
	class?: string;
}>();
</script>

<template>
	<CheckboxRoot
		v-model:checked="modelValue"
		:class="cn(
			'grid h-5 w-5 shrink-0 place-items-center rounded-md border border-input bg-background text-primary shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
			$props.class,
		)"
	>
		<CheckboxIndicator>
			<Check class="h-3.5 w-3.5" />
		</CheckboxIndicator>
	</CheckboxRoot>
</template>
