<script setup lang="ts">
import {
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogRoot,
	AlertDialogTitle,
} from "reka-ui";
import Button from "@/ui/components/Button.vue";

const open = defineModel<boolean>("open", { default: false });

withDefaults(defineProps<{
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
}>(), {
	confirmLabel: "Continue",
	cancelLabel: "Cancel",
	destructive: false,
});

defineEmits<{
	confirm: [];
}>();
</script>

<template>
	<AlertDialogRoot v-model:open="open">
		<AlertDialogPortal>
			<AlertDialogOverlay class="dialog-overlay fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
			<AlertDialogContent
				class="dialog-content fixed left-1/2 top-1/2 z-50 grid w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-2xl outline-none"
			>
				<div class="grid gap-2">
					<AlertDialogTitle class="text-lg font-semibold">
						{{ title }}
					</AlertDialogTitle>
					<AlertDialogDescription class="text-sm leading-6 text-muted-foreground">
						{{ description }}
					</AlertDialogDescription>
				</div>

				<div class="flex justify-end gap-2">
					<AlertDialogCancel as-child>
						<Button variant="outline" type="button">
							{{ cancelLabel }}
						</Button>
					</AlertDialogCancel>
					<AlertDialogAction as-child @click="$emit('confirm')">
						<Button :variant="destructive ? 'destructive' : 'default'" type="button">
							{{ confirmLabel }}
						</Button>
					</AlertDialogAction>
				</div>
			</AlertDialogContent>
		</AlertDialogPortal>
	</AlertDialogRoot>
</template>
