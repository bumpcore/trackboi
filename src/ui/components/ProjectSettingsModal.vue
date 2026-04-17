<script setup lang="ts">
import { ref, watch } from "vue";
import { ListPlus, Plus, Save, SlidersHorizontal, TableProperties, Trash2, X } from "lucide-vue-next";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import Select, { type SelectOption } from "@/ui/components/Select.vue";
import type { Column, CustomField, FieldType, ProjectSnapshot } from "@/core/types";

const props = defineProps<{
	open: boolean;
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
	close: [];
	saveBoardName: [];
	renameColumn: [column: Column];
	removeColumn: [column: Column];
	addColumn: [];
	addCustomField: [];
	removeCustomField: [fieldId: string];
}>();

type SettingsSection = "board" | "fields";

const activeSection = ref<SettingsSection>("board");

watch(
	() => props.open,
	(open) => {
		if (open) {
			activeSection.value = "board";
		}
	},
);
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-x-0 bottom-0 top-9 z-30 grid place-items-center bg-background/65 p-5 backdrop-blur-[2px]"
			@pointerdown.self="emit('close')"
		>
			<aside
				class="modal-panel grid h-[min(820px,calc(100vh-72px))] w-[min(980px,96vw)] grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
			>
				<div class="grid content-start border-r border-border/35 bg-background/32 p-4">
					<div class="grid gap-6">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-primary">Trackboi</p>
							<h2 class="mt-1 text-lg font-semibold tracking-tight">Project settings</h2>
							<p class="mt-2 text-sm leading-6 text-muted-foreground">
								{{ snapshot?.project.name ?? "Project" }}
							</p>
						</div>

						<div class="grid gap-4">
							<div>
								<p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Board</p>
								<button
									type="button"
									class="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
									:class="
										activeSection === 'board'
											? 'bg-card/55 text-foreground'
											: 'text-muted-foreground hover:bg-card/28 hover:text-foreground'
									"
									@click="activeSection = 'board'"
								>
									<TableProperties class="h-4 w-4 text-muted-foreground" />
									Board structure
								</button>
							</div>

							<div>
								<p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cards</p>
								<button
									type="button"
									class="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
									:class="
										activeSection === 'fields'
											? 'bg-card/55 text-foreground'
											: 'text-muted-foreground hover:bg-card/28 hover:text-foreground'
									"
									@click="activeSection = 'fields'"
								>
									<SlidersHorizontal class="h-4 w-4 text-muted-foreground" />
									Card fields
								</button>
							</div>
						</div>
					</div>
				</div>

				<div v-if="snapshot" class="app-scroll grid content-start gap-6 overflow-y-auto p-6">
					<header class="flex items-start justify-between gap-3 border-b border-border/30 pb-5">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-primary">
								{{ activeSection === "board" ? "Project" : "Cards" }}
							</p>
							<h2 class="mt-1 text-xl font-semibold tracking-tight">
								{{ activeSection === "board" ? snapshot.project.name : "Card fields" }}
							</h2>
							<p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
								{{
									activeSection === "board"
										? "Tune the board structure for this project. These settings shape how Trackboi stores and presents work in this repo."
										: "Define structured details that appear on every card in this project so humans and agents can reason about work with more context."
								}}
							</p>
						</div>
						<Button variant="ghost" size="icon" type="button" @click="emit('close')">
							<X class="h-4 w-4" />
						</Button>
					</header>

					<section
						v-if="activeSection === 'board'"
						class="grid gap-5 rounded-lg bg-background/12 p-1"
					>
						<div class="flex items-start gap-3">
							<div class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card/50 text-muted-foreground">
								<TableProperties class="h-4 w-4" />
							</div>
							<div>
								<p class="text-sm font-semibold text-foreground">Board structure</p>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Set the board name and keep the column model tidy. Column ids stay stable; labels are what people actually read.
								</p>
							</div>
						</div>

						<form class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="emit('saveBoardName')">
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Board name
								<Input v-model="boardNameDraft" autocomplete="off" placeholder="Board name" />
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
								class="grid gap-3 rounded-lg bg-card/18 px-4 py-4"
							>
								<div class="flex items-center justify-between gap-3">
									<div class="min-w-0">
										<p class="truncate text-sm font-medium text-foreground">{{ column.name }}</p>
										<p class="mt-1 font-mono text-[11px] text-muted-foreground">{{ column.id }}</p>
									</div>
									<Badge variant="outline">{{ columnCardCounts[column.id] ?? 0 }} cards</Badge>
								</div>
								<form class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]" @submit.prevent="emit('renameColumn', column)">
									<Input v-model="columnNameDrafts[column.id]" autocomplete="off" />
									<Button type="submit" variant="outline" :disabled="busy || !columnNameDrafts[column.id]?.trim()">
										Rename
									</Button>
									<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="emit('removeColumn', column)">
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

					<section
						v-else
						class="grid gap-5 rounded-lg bg-background/12 p-1"
					>
						<div class="flex items-start gap-3">
							<div class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card/50 text-muted-foreground">
								<SlidersHorizontal class="h-4 w-4" />
							</div>
							<div>
								<p class="text-sm font-semibold text-foreground">Card fields</p>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Define structured details that appear on every card in this project.
								</p>
							</div>
						</div>

						<div v-if="customFields.length > 0" class="grid gap-2">
							<div
								v-for="field in customFields"
								:key="field.id"
								class="flex items-center justify-between gap-3 rounded-lg bg-card/18 px-3 py-3"
							>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-foreground">{{ field.name }}</p>
									<p class="mt-1 text-xs text-muted-foreground">
										{{ field.type }}{{ field.options?.length ? `: ${field.options.join(", ")}` : "" }}
									</p>
								</div>
								<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="emit('removeCustomField', field.id)">
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>

						<div
							v-else
							class="rounded-lg bg-card/14 px-4 py-4 text-sm text-muted-foreground"
						>
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
			</aside>
		</div>
	</Transition>
</template>
