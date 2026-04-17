<script setup lang="ts">
import { computed } from "vue";
import { Plus, Save, Trash2, X } from "lucide-vue-next";
import type { Card as TrackboiCard, CustomField } from "@/core/types";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import Checkbox from "@/ui/components/Checkbox.vue";
import Input from "@/ui/components/Input.vue";
import MarkdownEditor from "@/ui/components/MarkdownEditor.vue";
import MarkdownInline from "@/ui/components/MarkdownInline.vue";
import MarkdownContent from "@/ui/components/MarkdownContent.vue";
import Select from "@/ui/components/Select.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { CardDraft, ChildProgress, FieldValuesDraft, ScopeMode } from "@/ui/viewTypes";

const props = defineProps<{
	card: TrackboiCard | null;
	busy: boolean;
	columnOptions: SelectOption[];
	scopeOptions: SelectOption[];
	targetWorktreeOptions: SelectOption[];
	targetWorktreeLocked: boolean;
	customFields: CustomField[];
	subtasks: TrackboiCard[];
	subtaskProgress: ChildProgress;
}>();

defineEmits<{
	close: [];
	save: [];
	delete: [card: TrackboiCard];
	editSubtask: [card: TrackboiCard];
	createSubtask: [];
}>();

const draft = defineModel<CardDraft>("draft", { required: true });
const scopeMode = defineModel<ScopeMode>("scopeMode", { required: true });
const fieldValues = defineModel<FieldValuesDraft>("fieldValues", { required: true });
const subtaskTitle = defineModel<string>("subtaskTitle", { required: true });
const targetWorktreeId = defineModel<string>("targetWorktreeId", { required: true });

const isOpen = computed(() => props.card != null);

function formatTimestamp(value?: string) {
	if (!value) return "Unknown";

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

function selectOptionsForField(field: CustomField): SelectOption[] {
	return (field.options ?? []).map((option) => ({ value: option, label: option }));
}

function fieldTextValue(fieldId: string) {
	const value = fieldValues.value[fieldId];
	return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function setFieldTextValue(field: CustomField, value: string | number | undefined) {
	const nextValue = value == null ? "" : String(value);
	fieldValues.value = {
		...fieldValues.value,
		[field.id]: field.type === "number" ? Number(nextValue) : nextValue,
	};
}

function fieldBooleanValue(fieldId: string) {
	return fieldValues.value[fieldId] === true;
}

function setFieldBooleanValue(field: CustomField, value: boolean) {
	fieldValues.value = {
		...fieldValues.value,
		[field.id]: value,
	};
}
</script>

<template>
	<Transition name="surface">
		<div
			v-if="isOpen && card"
			class="fixed inset-x-0 bottom-0 top-9 z-20 grid place-items-center bg-background/65 p-5 backdrop-blur-[2px]"
			@pointerdown.self="$emit('close')"
		>
			<aside
				class="modal-panel app-scroll grid max-h-[min(880px,calc(100vh-72px))] w-[min(760px,94vw)] content-start gap-4 overflow-auto rounded-lg border border-border bg-card p-5 shadow-2xl"
			>
				<header class="flex items-start justify-between gap-3">
					<div>
						<p class="text-xs font-semibold uppercase text-primary">Edit card</p>
						<h2 class="mt-1 text-lg font-semibold">Card details</h2>
					</div>
					<Button variant="ghost" size="icon" type="button" @click="$emit('close')">
						<X class="h-4 w-4" />
					</Button>
				</header>

				<div class="grid gap-2 rounded-md border border-border bg-background/70 p-3 text-xs text-muted-foreground">
					<div class="flex items-center justify-between gap-3">
						<span>ID</span>
						<span class="min-w-0 truncate font-mono text-foreground">{{ card.id }}</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span>Board</span>
						<span class="min-w-0 truncate font-mono text-foreground">{{ card.boardId }}</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span>Created</span>
						<span class="text-foreground">{{ formatTimestamp(card.createdAt) }}</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span>Updated</span>
						<span class="text-foreground">{{ formatTimestamp(card.updatedAt) }}</span>
					</div>
				</div>

				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Title
					<Input v-model="draft.title" autocomplete="off" />
				</label>

				<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					<span>Notes</span>
					<MarkdownEditor
						v-model="draft.description"
						placeholder="Write card notes in markdown. Type / for quick commands."
					/>
				</div>

				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Column
					<Select v-model="draft.column" :options="columnOptions" />
				</label>

				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Scope
					<Select v-model="scopeMode" :options="scopeOptions" />
				</label>

				<label v-if="targetWorktreeOptions.length > 0" class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Worktree
					<Select v-model="targetWorktreeId" :options="targetWorktreeOptions" :disabled="targetWorktreeLocked" />
				</label>

				<div v-if="card.conflicted && card.variants?.length" class="grid gap-2 rounded-md border border-border bg-background/50 p-3 text-xs">
					<div>
						<p class="font-semibold text-foreground">Conflicting variants</p>
						<p class="mt-1 text-muted-foreground">Newest update wins in the board, but every origin is still visible here.</p>
					</div>
					<div class="grid gap-2">
						<div
							v-for="variant in card.variants"
							:key="`${variant.worktreeId}:${variant.updatedAt}`"
							class="rounded-md border border-border/60 bg-card/60 p-2"
						>
							<div class="flex items-center gap-2">
								<Badge variant="secondary">{{ variant.worktreeName }}</Badge>
								<Badge variant="outline">{{ variant.updatedAt }}</Badge>
							</div>
							<MarkdownInline
								:value="variant.title"
								class="mt-2 block text-sm font-medium text-foreground"
							/>
							<MarkdownContent
								v-if="variant.description"
								:value="variant.description"
								preview
								class="mt-1 text-xs text-muted-foreground"
							/>
						</div>
					</div>
				</div>

				<div v-if="customFields.length > 0" class="grid gap-3 rounded-md border border-border bg-background/50 p-3">
					<div>
						<p class="text-xs font-semibold uppercase text-primary">Fields</p>
						<p class="mt-1 text-xs text-muted-foreground">
							Project-defined card details.
						</p>
					</div>

					<label
						v-for="field in customFields"
						:key="field.id"
						class="grid gap-1.5 text-xs font-medium text-muted-foreground"
					>
						{{ field.name }}
						<div v-if="field.type === 'checkbox'" class="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
							<Checkbox
								:model-value="fieldBooleanValue(field.id)"
								@update:model-value="setFieldBooleanValue(field, $event)"
							/>
							<span class="text-sm text-foreground">{{ fieldBooleanValue(field.id) ? "Yes" : "No" }}</span>
						</div>
						<Select
							v-else-if="field.type === 'select'"
							:model-value="fieldTextValue(field.id)"
							:options="selectOptionsForField(field)"
							@update:model-value="setFieldTextValue(field, $event)"
						/>
						<Input
							v-else
							:type="field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'"
							:model-value="fieldTextValue(field.id)"
							@update:model-value="setFieldTextValue(field, $event)"
						/>
					</label>
				</div>

				<div class="grid gap-3 rounded-md border border-border bg-background/50 p-3">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="text-xs font-semibold uppercase text-primary">Subtasks</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Break this card into smaller slices.
							</p>
						</div>
						<Badge variant="secondary">
							{{ subtaskProgress.done }}/{{ subtaskProgress.total }}
						</Badge>
					</div>

					<div v-if="subtasks.length > 0" class="grid gap-2">
						<button
							v-for="subtask in subtasks"
							:key="subtask.id"
							class="grid gap-1 rounded-md border border-border bg-card px-3 py-2 text-left transition hover:border-primary/40 hover:bg-secondary/60"
							type="button"
							@click="$emit('editSubtask', subtask)"
						>
							<MarkdownInline
								:value="subtask.title"
								class="block text-sm font-medium text-foreground"
							/>
							<span class="text-xs text-muted-foreground">{{ subtask.column }}</span>
						</button>
					</div>

					<form class="flex gap-2" @submit.prevent="$emit('createSubtask')">
						<Input v-model="subtaskTitle" autocomplete="off" placeholder="Add a subtask" />
						<Button type="submit" :disabled="busy || !subtaskTitle.trim()">
							<Plus class="h-4 w-4" />
							Add
						</Button>
					</form>
				</div>

				<div class="flex gap-2">
					<Button type="button" :disabled="busy || !draft.title.trim()" @click="$emit('save')">
						<Save class="h-4 w-4" />
						Save
					</Button>
					<Button variant="outline" type="button" :disabled="busy" @click="$emit('close')">
						Cancel
					</Button>
					<Button
						class="ml-auto"
						variant="destructive"
						type="button"
						:disabled="busy"
						@click="$emit('delete', card)"
					>
						<Trash2 class="h-4 w-4" />
						Delete
					</Button>
				</div>
			</aside>
		</div>
	</Transition>
</template>
