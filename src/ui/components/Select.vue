<script setup lang="ts">
import { Check, ChevronDown } from "lucide-vue-next";
import {
	SelectContent,
	SelectIcon,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	SelectPortal,
	SelectRoot,
	SelectTrigger,
	SelectValue,
	SelectViewport,
} from "reka-ui";
import { cn } from "@/ui/lib/utils";

export type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

const modelValue = defineModel<string>();

withDefaults(defineProps<{
	options: SelectOption[];
	placeholder?: string;
	disabled?: boolean;
	class?: string;
}>(), {
	placeholder: "Select",
	disabled: false,
	class: "",
});
</script>

<template>
	<SelectRoot v-model="modelValue" :disabled="disabled">
		<SelectTrigger
			:class="cn(
				'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
				$props.class,
			)"
		>
			<SelectValue :placeholder="placeholder" class="truncate text-left" />
			<SelectIcon class="shrink-0 text-muted-foreground">
				<ChevronDown class="h-4 w-4" />
			</SelectIcon>
		</SelectTrigger>

		<SelectPortal>
			<SelectContent
				position="popper"
				:side-offset="6"
				class="z-50 max-h-72 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out"
			>
				<SelectViewport class="p-1">
					<SelectItem
						v-for="option in options"
						:key="option.value"
						:value="option.value"
						:disabled="option.disabled"
						:class="cn(
							'relative flex h-8 cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
						)"
					>
						<span class="absolute left-2 grid h-4 w-4 place-items-center">
							<SelectItemIndicator>
								<Check class="h-4 w-4 text-primary" />
							</SelectItemIndicator>
						</span>
						<SelectItemText>{{ option.label }}</SelectItemText>
					</SelectItem>
				</SelectViewport>
			</SelectContent>
		</SelectPortal>
	</SelectRoot>
</template>
