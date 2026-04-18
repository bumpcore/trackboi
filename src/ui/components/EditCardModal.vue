<script setup lang="ts">
import { computed } from "vue";
import { MessageSquarePlus, Plus, Save, Trash2, X } from "lucide-vue-next";
import type { Card as TrackboiCard, CardComment, CustomField } from "@/core/types";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import Checkbox from "@/ui/components/Checkbox.vue";
import Input from "@/ui/components/Input.vue";
import MarkdownEditor from "@/ui/components/MarkdownEditor.vue";
import MarkdownInline from "@/ui/components/MarkdownInline.vue";
import MarkdownContent from "@/ui/components/MarkdownContent.vue";
import Select from "@/ui/components/Select.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { CardDraft, ChildProgress, FieldValuesDraft } from "@/ui/viewTypes";

const props = defineProps<{
	card: TrackboiCard | null;
	busy: boolean;
	columnOptions: SelectOption[];
	trackOptions: SelectOption[];
	targetWorktreeOptions: SelectOption[];
	targetWorktreeLocked: boolean;
	customFields: CustomField[];
	comments: CardComment[];
	subtasks: TrackboiCard[];
	subtaskProgress: ChildProgress;
}>();

defineEmits<{
	close: [];
	save: [];
	delete: [card: TrackboiCard];
	editSubtask: [card: TrackboiCard];
	createSubtask: [];
	addComment: [];
}>();

const draft = defineModel<CardDraft>("draft", { required: true });
const trackId = defineModel<string>("trackId", { required: true });
const fieldValues = defineModel<FieldValuesDraft>("fieldValues", { required: true });
const subtaskTitle = defineModel<string>("subtaskTitle", { required: true });
const commentAuthor = defineModel<string>("commentAuthor", { required: true });
const commentBody = defineModel<string>("commentBody", { required: true });
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

const sortedComments = computed(() => (
	[...props.comments].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
));

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
			class="fixed inset-x-0 bottom-0 top-9 z-20 grid place-items-center bg-background/74 p-5 backdrop-blur-[6px]"
			@pointerdown.self="$emit('close')"
		>
			<aside
				class="modal-panel app-scroll grid max-h-[min(900px,calc(100vh-64px))] w-[min(980px,96vw)] content-start overflow-auto rounded-[18px] border border-border/75 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--card)/0.96)_100%)] shadow-[0_1px_0_hsl(0_0%_100%/0.04),0_28px_64px_hsl(0_0%_0%/0.44)]"
			>
				<header class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/55 bg-card/96 px-6 py-5 backdrop-blur-md">
					<div class="min-w-0">
						<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/95">Edit Card</p>
						<h2 class="mt-1 text-[22px] font-semibold tracking-tight text-foreground">Card details</h2>
						<p class="mt-1 text-sm text-muted-foreground">Manage content, scope, fields, and subtasks from one surface.</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						class="rounded-[10px] border border-transparent hover:border-border/60 hover:bg-background/70"
						type="button"
						@click="$emit('close')"
					>
						<X class="h-4 w-4" />
					</Button>
				</header>

				<div class="grid gap-5 px-6 py-6 lg:grid-cols-[minmax(0,1.65fr)_300px]">
					<div class="grid min-w-0 content-start gap-5">
						<section class="grid gap-4 rounded-[14px] border border-border/55 bg-background/22 p-4">
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Summary</p>
								<p class="mt-1 text-sm text-muted-foreground">Keep the title sharp and the notes decision-oriented.</p>
							</div>

							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Title
								<Input
									v-model="draft.title"
									autocomplete="off"
									class="h-10 rounded-[10px] border-border/75 bg-background/62 px-3 text-[15px] font-medium"
								/>
							</label>

							<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								<span>Notes</span>
								<MarkdownEditor
									v-model="draft.description"
									placeholder="Write card notes in markdown. Type / for quick commands."
								/>
							</div>
						</section>

						<section class="grid gap-4 rounded-[14px] border border-border/55 bg-background/22 p-4">
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Placement</p>
								<p class="mt-1 text-sm text-muted-foreground">Where the card lives and which track or worktree owns it.</p>
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

							<label
								v-if="targetWorktreeOptions.length > 0"
								class="grid gap-1.5 text-xs font-medium text-muted-foreground"
							>
								Worktree
								<Select v-model="targetWorktreeId" :options="targetWorktreeOptions" :disabled="targetWorktreeLocked" />
							</label>
						</section>

						<div v-if="card.conflicted && card.variants?.length" class="grid gap-3 rounded-[14px] border border-border/55 bg-background/22 p-4 text-xs">
					<div>
						<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Variants</p>
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

						<div v-if="customFields.length > 0" class="grid gap-3 rounded-[14px] border border-border/55 bg-background/22 p-4">
					<div>
						<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Fields</p>
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

						<section class="grid gap-4 rounded-[14px] border border-border/55 bg-background/22 p-4">
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Comments</p>
								<p class="mt-1 text-sm text-muted-foreground">Keep task history, handoffs, and agent notes attached to the work.</p>
							</div>

							<div v-if="sortedComments.length > 0" class="grid gap-3">
								<article
									v-for="comment in sortedComments"
									:key="comment.id"
									class="grid gap-2 rounded-[12px] border border-border/55 bg-card/55 px-3 py-3"
								>
									<div class="flex items-center justify-between gap-3 text-xs">
										<span class="font-medium text-foreground">{{ comment.author }}</span>
										<span class="font-mono text-muted-foreground">{{ formatTimestamp(comment.createdAt) }}</span>
									</div>
									<MarkdownContent :value="comment.body" class="text-sm text-foreground" />
								</article>
							</div>
							<p v-else class="text-sm text-muted-foreground">No comments yet. Add a handoff note, investigation summary, or next-step context.</p>

							<div class="grid gap-3 rounded-[12px] border border-dashed border-border/70 bg-background/35 p-3">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Author
									<Input v-model="commentAuthor" autocomplete="off" placeholder="You or agent name" />
								</label>

								<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									<span>New comment</span>
									<MarkdownEditor
										v-model="commentBody"
										placeholder="Capture context, findings, blockers, or a handoff for the next person or agent."
									/>
								</div>

								<div class="flex justify-end">
									<Button type="button" :disabled="busy || !commentBody.trim()" @click="$emit('addComment')">
										<MessageSquarePlus class="h-4 w-4" />
										Add comment
									</Button>
								</div>
							</div>
						</section>
					</div>

					<div class="grid min-w-0 content-start gap-5">
						<section class="grid gap-3 rounded-[14px] border border-border/55 bg-background/22 p-4 text-xs text-muted-foreground">
							<div class="flex items-center justify-between gap-3">
								<span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Card Info</span>
								<Badge variant="outline" class="border-border/65 bg-background/42 text-foreground">{{ card.column }}</Badge>
							</div>
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
						</section>

						<div class="grid gap-3 rounded-[14px] border border-border/55 bg-background/22 p-4">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Subtasks</p>
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
					</div>
				</div>

				<div class="sticky bottom-0 flex gap-2 border-t border-border/55 bg-card/96 px-6 py-4 backdrop-blur-md">
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
