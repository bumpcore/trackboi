<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import { X } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import Tooltip from "@/ui/components/Tooltip.vue";

const props = defineProps<{
	open: boolean;
	busy: boolean;
}>();

const boardCreateNameDraft = defineModel<string>("boardCreateNameDraft", { required: true });

const emit = defineEmits<{
	close: [];
	create: [];
}>();

function handleEscapeKey(event: KeyboardEvent) {
	if (!props.open || event.key !== "Escape") return;
	emit("close");
}

watch(
	() => props.open,
	(open) => {
		if (open) window.addEventListener("keydown", handleEscapeKey);
		else window.removeEventListener("keydown", handleEscapeKey);
	},
	{ immediate: true },
);

onBeforeUnmount(() => {
	window.removeEventListener("keydown", handleEscapeKey);
});
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-x-0 bottom-0 top-9 z-30 grid place-items-center bg-background/65 p-5 backdrop-blur-[2px]"
			data-testid="board-create-modal"
			@pointerdown.self="emit('close')"
		>
			<aside class="modal-panel grid w-[min(520px,calc(100vw-32px))] overflow-hidden border border-border/60 bg-card shadow-2xl">
				<header class="flex items-start justify-between gap-3 border-b border-border/30 px-5 py-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-primary">Board</p>
						<h2 class="mt-1 text-xl font-semibold tracking-tight text-foreground">New board</h2>
						<p class="mt-2 text-sm leading-6 text-muted-foreground">
							Create another board inside the current project.
						</p>
					</div>
					<Tooltip content="Close" side="left">
						<Button variant="ghost" size="icon" type="button" class="rounded-[2px]" aria-label="Close" @click="emit('close')">
							<X class="h-4 w-4" />
						</Button>
					</Tooltip>
				</header>

				<form class="grid gap-4 p-5" @submit.prevent="emit('create')">
					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Name
						<Input v-model="boardCreateNameDraft" autocomplete="off" placeholder="Delivery" />
					</label>

					<div class="flex justify-end gap-2">
						<Button variant="outline" type="button" :disabled="busy" @click="emit('close')">
							Cancel
						</Button>
						<Button type="submit" :disabled="busy || !boardCreateNameDraft.trim()">
							Create
						</Button>
					</div>
				</form>
			</aside>
		</div>
	</Transition>
</template>
