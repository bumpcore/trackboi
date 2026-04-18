<script setup lang="ts">
import { ListPlus, Plus, Save, SlidersHorizontal, TableProperties, Trash2 } from "lucide-vue-next";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import Select, { type SelectOption } from "@/ui/components/Select.vue";
import type { Column, CustomField, FieldType, ProjectSnapshot } from "@/core/types";

defineProps<{
	snapshot: ProjectSnapshot | null;
	customFields: CustomField[];
	columnCardCounts: Record<string, number>;
	fieldTypeOptions: SelectOption[];
	busy: boolean;
}>();

const boardNameDraft = defineModel<string>("boardNameDraft", { required: true });
const columnNameDrafts = defineModel<Record<string, string>>("columnNameDrafts", { required: true });
const newColumnName = defineModel<string>("newColumnName", { required: true });
const fieldNameDraft = defineModel<string>("fieldNameDraft", { required: true });
const fieldTypeDraft = defineModel<FieldType>("fieldTypeDraft", { required: true });
const fieldOptionsDraft = defineModel<string>("fieldOptionsDraft", { required: true });

const emit = defineEmits<{
	saveBoardName: [];
	renameColumn: [column: Column];
	removeColumn: [column: Column];
	addColumn: [];
	addCustomField: [];
	removeCustomField: [fieldId: string];
}>();
</script>

<template>
	<div v-if="snapshot" class="grid content-start gap-5">
		<section class="shell-section">
			<div class="flex items-start gap-3">
				<div class="grid h-9 w-9 place-items-center rounded-md border border-border/80 bg-secondary/55 text-muted-foreground">
					<TableProperties class="h-4 w-4" />
				</div>
				<div>
					<p class="shell-section-title">Board structure</p>
					<p class="mt-1 text-sm text-muted-foreground">Tune the board shape for this project without leaving the workspace shell.</p>
				</div>
			</div>

			<form class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="emit('saveBoardName')">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Board name
					<Input v-model="boardNameDraft" autocomplete="off" />
				</label>
				<Button type="submit" :disabled="busy || !boardNameDraft.trim()">
					<Save class="h-4 w-4" />
					Save
				</Button>
			</form>

			<div class="grid gap-3">
				<div
					v-for="column in snapshot.board.columns"
					:key="column.id"
					class="rounded-md border border-border/80 bg-secondary/55 px-4 py-4"
				>
					<div class="flex items-center justify-between gap-3">
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-foreground">{{ column.name }}</p>
							<p class="mt-1 font-mono text-[11px] text-muted-foreground">{{ column.id }}</p>
						</div>
						<Badge variant="outline">{{ columnCardCounts[column.id] ?? 0 }} cards</Badge>
					</div>
					<form class="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]" @submit.prevent="emit('renameColumn', column)">
						<Input v-model="columnNameDrafts[column.id]" autocomplete="off" />
						<Button type="submit" variant="outline" :disabled="busy || !columnNameDrafts[column.id]?.trim()">Rename</Button>
						<Button variant="outline" type="button" :disabled="busy" @click="emit('removeColumn', column)">
							<Trash2 class="h-4 w-4" />
						</Button>
					</form>
				</div>
			</div>

			<form class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="emit('addColumn')">
				<Input v-model="newColumnName" autocomplete="off" placeholder="New column" />
				<Button type="submit" :disabled="busy || !newColumnName.trim()">
					<Plus class="h-4 w-4" />
					Add column
				</Button>
			</form>
		</section>

		<section class="shell-section">
			<div class="flex items-start gap-3">
				<div class="grid h-9 w-9 place-items-center rounded-md border border-border/80 bg-secondary/55 text-muted-foreground">
					<SlidersHorizontal class="h-4 w-4" />
				</div>
				<div>
					<p class="shell-section-title">Card fields</p>
					<p class="mt-1 text-sm text-muted-foreground">Define structured details that show up across the board and inspectors.</p>
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
</template>
