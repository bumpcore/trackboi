<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import { Layers3, Save, SlidersHorizontal, Trash2, X } from "lucide-vue-next";
import type { CustomField, FieldType, ProjectSnapshot } from "@/core/types";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import Select, { type SelectOption } from "@/ui/components/Select.vue";

const props = defineProps<{
	open: boolean;
	busy: boolean;
	snapshot: ProjectSnapshot | null;
	boardCount: number;
	customFields: CustomField[];
	fieldTypeOptions: SelectOption[];
}>();

const boardNameDraft = defineModel<string>("boardNameDraft", { required: true });
const fieldNameDraft = defineModel<string>("fieldNameDraft", { required: true });
const fieldTypeDraft = defineModel<FieldType>("fieldTypeDraft", { required: true });
const fieldOptionsDraft = defineModel<string>("fieldOptionsDraft", { required: true });

const emit = defineEmits<{
	close: [];
	deleteBoard: [];
	saveBoardName: [];
	addCustomField: [];
	removeCustomField: [fieldId: string];
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
			data-testid="board-settings-modal"
			@pointerdown.self="emit('close')"
		>
			<aside class="modal-panel grid h-[min(820px,calc(100vh-72px))] w-[min(980px,96vw)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
				<header class="flex items-start justify-between gap-3 border-b border-border/30 px-6 py-5">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-primary">Board</p>
						<h2 class="mt-1 text-xl font-semibold tracking-tight text-foreground">{{ snapshot?.board.name ?? "Board settings" }}</h2>
						<p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							Adjust this board's name and custom fields. Column structure lives in the board canvas and right panel.
						</p>
					</div>
					<Button variant="ghost" size="icon" type="button" @click="emit('close')">
						<X class="h-4 w-4" />
					</Button>
				</header>

				<div class="app-scroll min-h-0 overflow-y-auto p-6">
					<div v-if="snapshot" class="grid content-start gap-5">
						<section class="shell-section">
							<div class="flex items-start gap-3">
								<div class="grid h-9 w-9 place-items-center rounded-md border border-border/80 bg-secondary/55 text-muted-foreground">
									<Layers3 class="h-4 w-4" />
								</div>
								<div>
									<p class="shell-section-title">Current board</p>
									<p class="mt-1 text-sm text-muted-foreground">Rename the active board. Column structure now lives in the right-side workspace.</p>
								</div>
							</div>

							<form class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="emit('saveBoardName')">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Board name
									<Input v-model="boardNameDraft" autocomplete="off" />
								</label>
								<div class="flex items-end gap-2">
									<Button type="submit" :disabled="busy || !boardNameDraft.trim()">
										<Save class="h-4 w-4" />
										Save
									</Button>
									<Button
										v-if="boardCount > 1"
										variant="outline"
										type="button"
										:disabled="busy"
										@click="emit('deleteBoard')"
									>
										<Trash2 class="h-4 w-4" />
										Delete
									</Button>
								</div>
							</form>
						</section>

						<section class="shell-section">
							<div class="flex items-start gap-3">
								<div class="grid h-9 w-9 place-items-center rounded-md border border-border/80 bg-secondary/55 text-muted-foreground">
									<SlidersHorizontal class="h-4 w-4" />
								</div>
								<div>
									<p class="shell-section-title">Board fields</p>
									<p class="mt-1 text-sm text-muted-foreground">Define structured metadata that belongs to this board only.</p>
								</div>
							</div>

							<div v-if="customFields.length > 0" class="grid gap-2">
								<div
									v-for="field in customFields"
									:key="field.id"
									class="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-secondary/55 px-3 py-3"
								>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium text-foreground">{{ field.name }}</p>
										<p class="mt-1 text-xs text-muted-foreground">
											{{ field.type }}{{ field.options?.length ? `: ${field.options.join(", ")}` : "" }}
										</p>
									</div>
									<Button variant="outline" type="button" :disabled="busy" @click="emit('removeCustomField', field.id)">
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>

							<div v-else class="rounded-md border border-dashed border-border/75 bg-background/20 px-4 py-4 text-sm text-muted-foreground">
								No custom fields yet.
							</div>

							<form class="grid gap-3" @submit.prevent="emit('addCustomField')">
								<div class="grid gap-3 md:grid-cols-2">
									<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
										Field name
										<Input v-model="fieldNameDraft" autocomplete="off" placeholder="Priority" />
									</label>
									<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
										Field type
										<Select v-model="fieldTypeDraft" :options="fieldTypeOptions" />
									</label>
								</div>
								<label v-if="fieldTypeDraft === 'select'" class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Options
									<Input v-model="fieldOptionsDraft" autocomplete="off" placeholder="Low, Medium, High" />
								</label>
								<div>
									<Button type="submit" :disabled="busy || !fieldNameDraft.trim()">
										<ListPlus class="h-4 w-4" />
										Add field
									</Button>
								</div>
							</form>
						</section>
					</div>
				</div>
			</aside>
		</div>
	</Transition>
</template>
