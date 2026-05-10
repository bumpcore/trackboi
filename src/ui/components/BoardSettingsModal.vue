<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import { RotateCcw, Trash2, X } from "lucide-vue-next";
import type { Card, Column, CustomField, FieldType, ProjectSnapshot } from "@/core/types";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import Select, { type SelectOption } from "@/ui/components/Select.vue";
import Tooltip from "@/ui/components/Tooltip.vue";

const props = defineProps<{
	open: boolean;
	busy: boolean;
	snapshot: ProjectSnapshot | null;
	boardCount: number;
	customFields: CustomField[];
	fieldTypeOptions: SelectOption[];
	archivedCards: Card[];
	archivedColumns: Column[];
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
	restoreCard: [card: Card];
	restoreColumn: [columnId: string];
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
			<aside class="modal-panel app-scroll grid h-[min(760px,calc(100vh-72px))] w-[min(760px,96vw)] min-h-0 content-start gap-6 overflow-y-auto border border-border/60 bg-card p-6 shadow-2xl">
				<header class="flex items-start justify-between gap-3 border-b border-border/30 pb-5">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-primary">Current board</p>
						<h2 class="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">{{ snapshot?.board.name ?? "Board settings" }}</h2>
						<p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							Adjust the board name and board-owned fields. Columns stay on the canvas and right panel.
						</p>
					</div>
					<Tooltip content="Close" side="left">
						<Button variant="ghost" size="icon" type="button" class="rounded-[2px]" aria-label="Close" @click="emit('close')">
							<X class="h-4 w-4" />
						</Button>
					</Tooltip>
				</header>

				<div v-if="snapshot" class="grid content-start gap-6">
					<section class="grid gap-4 bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Name</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">Rename the active board without touching its cards, columns, or custom field values.</p>
							</div>

							<form class="grid gap-3" @submit.prevent="emit('saveBoardName')">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Board name
									<Input v-model="boardNameDraft" autocomplete="off" />
								</label>
								<div class="flex justify-end">
									<Button type="submit" class="rounded-none" :disabled="busy || !boardNameDraft.trim()">
										Save
									</Button>
								</div>
							</form>
						</section>

						<section class="grid gap-4 bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Fields</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">Define structured metadata that belongs to this board only.</p>
							</div>

							<div v-if="customFields.length > 0" class="grid border border-border/50">
								<div
									v-for="field in customFields"
									:key="field.id"
									class="flex items-center justify-between gap-3 border-b border-border/35 bg-secondary/35 px-3 py-3 last:border-b-0"
								>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium text-foreground">{{ field.name }}</p>
										<p class="mt-1 truncate text-xs text-muted-foreground">
											{{ field.type }}{{ field.options?.length ? `: ${field.options.join(", ")}` : "" }}
										</p>
									</div>
									<Tooltip content="Remove field" side="left">
										<Button variant="ghost" size="icon" type="button" class="rounded-none text-muted-foreground hover:text-destructive" aria-label="Remove field" :disabled="busy" @click="emit('removeCustomField', field.id)">
											<Trash2 class="h-4 w-4" />
										</Button>
									</Tooltip>
								</div>
							</div>

							<div v-else class="border border-dashed border-border/75 bg-background/20 px-4 py-4 text-sm text-muted-foreground">
								No custom fields yet.
							</div>

							<form class="grid gap-3 border-t border-border/30 pt-4" @submit.prevent="emit('addCustomField')">
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
								<div class="flex justify-end">
									<Button type="submit" class="rounded-none" :disabled="busy || !fieldNameDraft.trim()">
										Add
									</Button>
								</div>
							</form>
						</section>

						<section class="grid gap-4 bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Archived</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">Restore hidden cards and columns without touching their files.</p>
							</div>

							<div v-if="archivedColumns.length > 0 || archivedCards.length > 0" class="grid gap-3">
								<div v-if="archivedColumns.length > 0" class="grid border border-border/50">
									<div
										v-for="column in archivedColumns"
										:key="column.id"
										class="flex items-center justify-between gap-3 border-b border-border/35 bg-secondary/35 px-3 py-3 last:border-b-0"
									>
										<div class="min-w-0">
											<p class="truncate text-sm font-medium text-foreground">{{ column.name }}</p>
											<p class="mt-1 truncate text-xs text-muted-foreground">Column · {{ column.id }}</p>
										</div>
										<Tooltip content="Restore column" side="left">
											<Button variant="ghost" size="icon" type="button" class="rounded-none text-muted-foreground hover:text-foreground" aria-label="Restore column" :disabled="busy" @click="emit('restoreColumn', column.id)">
												<RotateCcw class="h-4 w-4" />
											</Button>
										</Tooltip>
									</div>
								</div>

								<div v-if="archivedCards.length > 0" class="grid border border-border/50">
									<div
										v-for="card in archivedCards"
										:key="card.id"
										class="flex items-center justify-between gap-3 border-b border-border/35 bg-secondary/35 px-3 py-3 last:border-b-0"
									>
										<div class="min-w-0">
											<p class="truncate text-sm font-medium text-foreground">{{ card.title }}</p>
											<p class="mt-1 truncate text-xs text-muted-foreground">Card · {{ snapshot?.board.columns.find((column) => column.id === card.column)?.name ?? card.column }}</p>
										</div>
										<Tooltip content="Restore card" side="left">
											<Button variant="ghost" size="icon" type="button" class="rounded-none text-muted-foreground hover:text-foreground" aria-label="Restore card" :disabled="busy" @click="emit('restoreCard', card)">
												<RotateCcw class="h-4 w-4" />
											</Button>
										</Tooltip>
									</div>
								</div>
							</div>

							<div v-else class="border border-dashed border-border/75 bg-background/20 px-4 py-4 text-sm text-muted-foreground">
								No archived items.
							</div>
						</section>

						<section v-if="boardCount > 1" class="grid gap-4 border border-destructive/20 bg-destructive/5 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Delete board</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Remove this board after its cards have been moved or deleted.
								</p>
							</div>
							<div class="flex justify-end">
								<Button variant="outline" type="button" class="rounded-none text-destructive hover:text-destructive" :disabled="busy" @click="emit('deleteBoard')">
									Delete
								</Button>
							</div>
					</section>
				</div>
			</aside>
		</div>
	</Transition>
</template>
