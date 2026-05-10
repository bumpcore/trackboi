<script setup lang="ts">
import {
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
	heading: string;
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
				data-testid="confirm-dialog"
				class="dialog-content fixed left-1/2 top-1/2 z-50 grid w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[2px] border border-border bg-card p-5 text-card-foreground shadow-2xl outline-none"
			>
				<div class="grid gap-2">
					<AlertDialogTitle class="text-lg font-semibold">
						{{ heading }}
					</AlertDialogTitle>
					<AlertDialogDescription class="whitespace-pre-line text-sm leading-6 text-muted-foreground">
						{{ description }}
					</AlertDialogDescription>
				</div>

				<div class="flex justify-end gap-2">
					<Button variant="outline" type="button" @click="open = false">
						{{ cancelLabel }}
					</Button>
					<Button
						:variant="destructive ? 'destructive' : 'default'"
						type="button"
						@click="$emit('confirm')"
					>
						{{ confirmLabel }}
					</Button>
				</div>
			</AlertDialogContent>
		</AlertDialogPortal>
	</AlertDialogRoot>
</template>
