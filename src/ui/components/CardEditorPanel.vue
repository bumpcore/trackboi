<script setup lang="ts">
import { computed } from "vue";
import { MessageSquarePlus, Plus } from "lucide-vue-next";
import type { Card as TrackboiCard, CardComment, CustomField } from "@/core/types";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import Checkbox from "@/ui/components/Checkbox.vue";
import Input from "@/ui/components/Input.vue";
import MarkdownEditor from "@/ui/components/MarkdownEditor.vue";
import MarkdownContent from "@/ui/components/MarkdownContent.vue";
import MarkdownInline from "@/ui/components/MarkdownInline.vue";
import Select from "@/ui/components/Select.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { CardDraft, ChildProgress, FieldValuesDraft } from "@/ui/viewTypes";

const props = defineProps<{
	busy: boolean;
	card: TrackboiCard | null;
	mode: "create" | "edit";
	columnOptions: SelectOption[];
	trackOptions: SelectOption[];
	targetWorktreeOptions: SelectOption[];
	customFields: CustomField[];
	comments: CardComment[];
	subtasks: TrackboiCard[];
	subtaskProgress: ChildProgress;
}>();

const draft = defineModel<CardDraft>("draft", { required: true });
const trackId = defineModel<string>("trackId", { required: true });
const fieldValues = defineModel<FieldValuesDraft>("fieldValues", { required: true });
const subtaskTitle = defineModel<string>("subtaskTitle", { required: true });
const commentAuthor = defineModel<string>("commentAuthor", { required: true });
const commentBody = defineModel<string>("commentBody", { required: true });
const targetWorktreeId = defineModel<string>("targetWorktreeId", { required: true });

const emit = defineEmits<{
	submit: [];
	delete: [card: TrackboiCard];
	addComment: [];
	createSubtask: [];
	editSubtask: [card: TrackboiCard];
}>();

const isCreate = computed(() => props.mode === "create");
const sortedComments = computed(() => (
	[...props.comments].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
));

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
	<div class="grid content-start gap-5">
		<section class="shell-section">
			<div>
				<p class="shell-section-title">Summary</p>
				<p class="mt-1 text-sm text-muted-foreground">Keep the task title sharp and the notes decision-oriented.</p>
			</div>
			<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				Title
				<Input v-model="draft.title" autocomplete="off" class="h-9" />
			</label>
			<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				<span>Notes</span>
				<MarkdownEditor v-model="draft.description" placeholder="Write task notes in markdown." />
			</div>
		</section>

		<section class="shell-section">
			<div>
				<p class="shell-section-title">Placement</p>
				<p class="mt-1 text-sm text-muted-foreground">Choose where this card belongs and which track owns it.</p>
			</div>
			<div class="grid gap-4 md:grid-cols-2">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Column
					<Select v-model="draft.column" :options="columnOptions" />
				</label>
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Track
					<Select v-model="trackId" :options="trackOptions" />
				</label>
			</div>
			<label v-if="targetWorktreeOptions.length > 0" class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				Worktree
				<Select v-model="targetWorktreeId" :options="targetWorktreeOptions" />
			</label>
		</section>

		<section v-if="customFields.length > 0" class="shell-section">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="shell-section-title">Fields</p>
					<p class="mt-1 text-xs text-muted-foreground">Project-defined metadata for this task.</p>
				</div>
				<span class="font-mono text-[10px] text-muted-foreground">project-defined</span>
			</div>

			<label
				v-for="field in customFields"
				:key="field.id"
				class="grid gap-1.5 text-xs font-medium text-muted-foreground"
			>
				{{ field.name }}
				<div v-if="field.type === 'checkbox'" class="flex items-center gap-2 rounded-md border border-input/70 bg-background/35 px-3 py-2">
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
		</section>

		<section v-if="!isCreate && card" class="shell-section">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="shell-section-title">Subtasks</p>
					<p class="mt-1 text-xs text-muted-foreground">Break this card into smaller work slices.</p>
				</div>
				<Badge variant="outline">{{ subtaskProgress.done }}/{{ subtaskProgress.total }}</Badge>
			</div>

			<div v-if="subtasks.length > 0" class="grid gap-2">
				<button
					v-for="subtask in subtasks"
					:key="subtask.id"
					type="button"
					class="rounded-md border border-border/80 bg-secondary/55 px-3 py-2 text-left transition hover:border-primary/35 hover:bg-secondary/80"
					@click="emit('editSubtask', subtask)"
				>
					<MarkdownInline :value="subtask.title" class="block text-sm font-medium text-foreground" />
					<span class="text-xs text-muted-foreground">{{ subtask.column }}</span>
				</button>
			</div>

			<form class="flex gap-2" @submit.prevent="emit('createSubtask')">
				<Input v-model="subtaskTitle" autocomplete="off" placeholder="Add a subtask" />
				<Button type="submit" :disabled="busy || !subtaskTitle.trim()">
					<Plus class="h-4 w-4" />
					Add
				</Button>
			</form>
		</section>

		<section v-if="!isCreate && card" class="shell-section">
			<div>
				<p class="shell-section-title">Comments</p>
				<p class="mt-1 text-sm text-muted-foreground">Keep handoff notes and investigation history attached to the task.</p>
			</div>
			<div v-if="sortedComments.length > 0" class="grid gap-3">
				<article
					v-for="comment in sortedComments"
					:key="comment.id"
					class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3"
				>
					<div class="flex items-center justify-between gap-3 text-xs">
						<span class="font-medium text-foreground">{{ comment.author }}</span>
						<span class="font-mono text-muted-foreground">{{ formatTimestamp(comment.createdAt) }}</span>
					</div>
					<MarkdownContent :value="comment.body" class="mt-2 text-sm text-foreground" />
				</article>
			</div>
			<p v-else class="text-sm text-muted-foreground">No comments yet.</p>

			<div class="rounded-md border border-dashed border-border/75 bg-background/20 p-3">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Author
					<Input v-model="commentAuthor" autocomplete="off" placeholder="You or agent name" />
				</label>
				<div class="mt-3 grid gap-1.5 text-xs font-medium text-muted-foreground">
					<span>New comment</span>
					<MarkdownEditor v-model="commentBody" placeholder="Capture findings, blockers, or the next handoff." />
				</div>
				<div class="mt-3 flex justify-end">
					<Button type="button" :disabled="busy || !commentBody.trim()" @click="emit('addComment')">
						<MessageSquarePlus class="h-4 w-4" />
						Add comment
					</Button>
				</div>
			</div>
		</section>

		<section v-if="!isCreate && card" class="shell-section">
			<div class="flex items-center justify-between gap-3">
				<p class="shell-section-title">Metadata</p>
				<Badge variant="outline">{{ card.column }}</Badge>
			</div>
			<div class="grid gap-2 text-xs text-muted-foreground">
				<div class="flex items-center justify-between gap-3">
					<span>ID</span>
					<span class="truncate font-mono text-foreground">{{ card.id }}</span>
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
		</section>

	</div>
</template>
