<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle, FolderOpen, GitBranch, Layers, Plus, RefreshCw, Settings, Trash2, X } from "lucide-vue-next";
import type { Card as TrackboiCard, CustomField, ProjectEntry, ProjectSnapshot, WorktreeContext } from "@/core/types";
import Badge from "@/ui/components/Badge.vue";
import BoardColumn from "@/ui/components/BoardColumn.vue";
import Button from "@/ui/components/Button.vue";
import UiCard from "@/ui/components/Card.vue";
import Select from "@/ui/components/Select.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import { projectColorStyle } from "@/ui/lib/projectColor";
import type { BoardScopeMode, ChildProgress } from "@/ui/viewTypes";

const props = defineProps<{
	activeProject: ProjectEntry | null;
	activeWorkspaceFile: string | null;
	boardScopeOptions: SelectOption[];
	branchLabel: string | null;
	busy: boolean;
	canRemoveActiveProject: boolean;
	cardsByColumn: Map<string, TrackboiCard[]>;
	childProgress: Record<string, ChildProgress>;
	customFields: CustomField[];
	error: string | null;
	hasProjects: boolean;
	loading: boolean;
	worktreeFilterId: string | null;
	selectedWorktreeId: string | null;
	scopeEmptyMessage: string | null;
	snapshot: ProjectSnapshot | null;
	visibleCardCount: number;
	worktrees: WorktreeContext[];
	worktreeOptions: SelectOption[];
}>();

const boardScopeMode = defineModel<BoardScopeMode>("boardScopeMode", { required: true });

const emit = defineEmits<{
	chooseProject: [];
	closeWorkspace: [];
	createCard: [columnId?: string];
	deleteCard: [card: TrackboiCard];
	editCard: [card: TrackboiCard];
	locateProject: [projectId: string];
	moveCard: [cardId: string, toColumn: string, beforeCardId: string | null];
	openWorkspace: [];
	openNewCard: [];
	projectSettings: [];
	removeProject: [projectId: string];
	selectWorktree: [worktreeId: string];
}>();

function forwardMove(cardId: string, toColumn: string, beforeCardId: string | null) {
	emit("moveCard", cardId, toColumn, beforeCardId);
}

function forwardWorktreeSelection(worktreeId: string | undefined) {
	if (!worktreeId) return;
	emit("selectWorktree", worktreeId);
}

const worktreeFilterValue = computed(() => (
	props.worktreeFilterId ?? "__all__"
));

function projectInitial(name: string | undefined) {
	return (name ?? "Trackboi").slice(0, 1).toUpperCase();
}

function workspaceFileLabel(filePath: string) {
	const trimmed = filePath.split("/").filter(Boolean).pop() ?? filePath;
	return trimmed.replace(/\.code-workspace$/, "");
}
</script>

<template>
	<section class="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
		<header class="border-b border-border/45 bg-card/72 px-5 py-3 shadow-[0_1px_0_hsl(var(--border)/0.32)]">
			<div class="flex items-start justify-between gap-4">
				<div class="flex min-w-0 items-start gap-3">
					<div
						class="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--project-color)] text-sm font-semibold text-[var(--project-fg)]"
						:style="projectColorStyle(activeProject)"
					>
						{{ projectInitial(activeProject?.name ?? snapshot?.project.name) }}
					</div>
					<div class="min-w-0">
						<p class="text-[11px] font-semibold uppercase text-primary/90">Workspace</p>
						<h1 class="mt-0.5 truncate text-lg font-semibold tracking-tight">
							{{ activeProject?.name ?? snapshot?.project.name ?? "No project selected" }}
						</h1>
						<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
							<Badge v-if="branchLabel" variant="outline" class="max-w-60 gap-1.5">
								<GitBranch class="h-3 w-3 shrink-0" />
								<span class="truncate">{{ branchLabel }}</span>
							</Badge>
							<Badge v-if="activeProject?.status === 'uninitialized'" variant="outline">new storage</Badge>
							<Badge v-else-if="activeProject?.status === 'missing'" variant="outline">missing folder</Badge>
							<Badge v-if="activeWorkspaceFile" variant="secondary" class="max-w-60 gap-1.5">
								<Layers class="h-3 w-3 shrink-0" />
								<span class="truncate">{{ workspaceFileLabel(activeWorkspaceFile) }}</span>
							</Badge>
						</div>
					</div>
				</div>

				<div class="flex shrink-0 flex-wrap justify-end gap-1.5">
					<Button variant="outline" type="button" :disabled="busy" @click="$emit('chooseProject')">
						<FolderOpen class="h-4 w-4" />
						Add project
					</Button>
					<Button v-if="!activeWorkspaceFile" variant="outline" type="button" :disabled="busy" @click="$emit('openWorkspace')">
						<Layers class="h-4 w-4" />
						Open workspace
					</Button>
					<Tooltip v-else content="Close workspace" side="bottom">
						<Button variant="outline" size="icon" type="button" :disabled="busy" @click="$emit('closeWorkspace')">
							<X class="h-4 w-4" />
						</Button>
					</Tooltip>
					<Button v-if="snapshot" type="button" :disabled="busy" @click="$emit('openNewCard')">
						<Plus class="h-4 w-4" />
						New card
					</Button>
				</div>
			</div>
		</header>

		<div class="border-b border-border/40 bg-secondary/22 shadow-[0_1px_0_hsl(var(--border)/0.18)]">
			<div class="flex items-end justify-between gap-4 px-5 py-2.5">
				<div class="min-w-0">
					<p class="text-[11px] font-semibold uppercase text-muted-foreground">Board</p>
					<h2 class="mt-0.5 truncate text-xl font-semibold tracking-tight">
						{{ snapshot?.board.name ?? "No board loaded" }}
					</h2>
				</div>
				<div v-if="snapshot" class="flex shrink-0 items-center gap-1.5">
					<Badge variant="secondary">{{ visibleCardCount }} shown</Badge>
					<Select
						v-if="worktreeOptions.length > 1"
						:model-value="worktreeFilterValue"
						:options="worktreeOptions"
						class="w-44"
						placeholder="Worktree"
						@update:model-value="forwardWorktreeSelection"
					/>
					<Select v-model="boardScopeMode" :options="boardScopeOptions" class="w-40" />
					<Tooltip content="Project settings" side="bottom">
						<Button variant="outline" size="icon" type="button" :disabled="busy" @click="$emit('projectSettings')">
							<Settings class="h-4 w-4" />
						</Button>
					</Tooltip>
					<template v-if="activeProject && canRemoveActiveProject">
						<Tooltip content="Locate project folder" side="bottom">
							<Button variant="outline" size="icon" type="button" :disabled="busy" @click="$emit('locateProject', activeProject.projectId)">
								<RefreshCw class="h-4 w-4" />
							</Button>
						</Tooltip>
						<Tooltip content="Remove project" side="bottom">
							<Button variant="outline" size="icon" type="button" :disabled="busy" @click="$emit('removeProject', activeProject.projectId)">
								<Trash2 class="h-4 w-4" />
							</Button>
						</Tooltip>
					</template>
				</div>
			</div>
		</div>

		<div class="app-scroll min-h-0 min-w-0 overflow-auto">
			<UiCard v-if="error" class="mb-4 border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive-foreground">
				{{ error }}
			</UiCard>

			<UiCard v-if="loading" class="mt-20 grid max-w-md gap-2 border-dashed p-8">
				<h2 class="text-xl font-semibold">Loading board</h2>
				<p class="text-sm text-muted-foreground">Looking for the nearest repo.</p>
			</UiCard>

			<UiCard v-else-if="activeProject?.status === 'missing'" class="mt-20 grid max-w-xl gap-4 border-dashed p-8">
				<div class="flex items-start gap-3">
					<div class="grid h-10 w-10 place-items-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive">
						<AlertTriangle class="h-5 w-5" />
					</div>
					<div class="min-w-0">
						<h2 class="text-xl font-semibold">Project folder is missing</h2>
						<p class="mt-2 text-sm text-muted-foreground">
							Trackboi kept the entry so you can point it at the folder again or remove it from the rail.
						</p>
						<p class="mt-3 truncate rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
							{{ activeProject.path }}
						</p>
					</div>
				</div>
				<div v-if="canRemoveActiveProject" class="flex flex-wrap gap-2">
					<Button type="button" :disabled="busy" @click="$emit('locateProject', activeProject.projectId)">
						<RefreshCw class="h-4 w-4" />
						Locate folder
					</Button>
					<Button variant="outline" type="button" :disabled="busy" @click="$emit('removeProject', activeProject.projectId)">
						<Trash2 class="h-4 w-4" />
						Remove from Trackboi
					</Button>
				</div>
				<p v-else class="text-sm text-muted-foreground">
					This project is discovered from a worktree or workspace. Fix the source folder to bring it back.
				</p>
			</UiCard>

			<UiCard v-else-if="!snapshot" class="mt-20 grid max-w-md gap-4 border-dashed p-8">
				<div>
					<h2 class="text-xl font-semibold">{{ hasProjects ? "Pick a project" : "Pick a repo" }}</h2>
					<p class="mt-2 text-sm text-muted-foreground">
						Trackboi will create a `.trackboi` folder with a starter board.
					</p>
				</div>
				<Button class="w-fit" type="button" :disabled="busy" @click="$emit('chooseProject')">
					<FolderOpen class="h-4 w-4" />
					Choose project
				</Button>
			</UiCard>

			<div v-else class="flex min-w-max items-start gap-3.5 p-5">
				<BoardColumn
					v-for="column in snapshot.board.columns"
					:key="column.id"
					:column="column"
					:cards="cardsByColumn.get(column.id) ?? []"
					:child-progress="childProgress"
					:custom-fields="customFields"
					@move="forwardMove"
					@create="emit('createCard', $event)"
					@edit="emit('editCard', $event)"
					@delete="emit('deleteCard', $event)"
				/>
			</div>
			<p v-if="scopeEmptyMessage" class="px-6 pb-6 text-sm text-muted-foreground">
				{{ scopeEmptyMessage }}
			</p>
		</div>
	</section>
</template>
