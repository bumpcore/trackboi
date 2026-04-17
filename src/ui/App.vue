<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import BoardView from "@/ui/components/BoardView.vue";
import EditCardModal from "@/ui/components/EditCardModal.vue";
import NewCardModal from "@/ui/components/NewCardModal.vue";
import ProjectSidebar from "@/ui/components/ProjectSidebar.vue";
import ProjectSettingsModal from "@/ui/components/ProjectSettingsModal.vue";
import SettingsModal from "@/ui/components/SettingsModal.vue";
import TitleBar from "@/ui/components/TitleBar.vue";
import { useConfirmation } from "@/ui/composables/useConfirmation";
import { useWindowChrome } from "@/ui/composables/useWindowChrome";
import { desktop } from "@/electron/renderer";
import ConfirmDialog from "@/ui/components/ConfirmDialog.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { BoardScopeMode, CardDraft, ChildProgress, ScopeMode } from "@/ui/viewTypes";
import type {
	Column,
	CustomField,
	Card as TrackboiCard,
	DesktopState,
	FieldType,
	FieldValue,
	ProjectEntry,
	ProjectSnapshot,
	ProjectView,
	WorkScope,
	WorktreeContext,
} from "@/core/types";

const snapshot = ref<ProjectSnapshot | null>(null);
const view = ref<ProjectView>({ sources: [], activeProjectId: null, storageSearchPaths: [] });
const loading = ref(true);
const busy = ref(false);
const error = ref<string | null>(null);
const settingsOpen = ref(false);
const projectSettingsOpen = ref(false);
const draftTitle = ref("");
const draftDescription = ref("");
const draftColumn = ref("todo");
const subtaskTitle = ref("");
const storagePathDraft = ref("");
const fieldNameDraft = ref("");
const fieldTypeDraft = ref<FieldType>("text");
const fieldOptionsDraft = ref("");
const boardNameDraft = ref("");
const columnNameDrafts = ref<Record<string, string>>({});
const newColumnName = ref("");
const editingCard = ref<TrackboiCard | null>(null);
const editFieldValues = ref<Record<string, FieldValue>>({});
const editDraft = reactive<CardDraft>({
	title: "",
	description: "",
	column: "todo",
});
const {
	closeWindow,
	handleTitlebarDoubleClick,
	minimizeWindow,
	resizeCursor,
	resizeEdges,
	resizeHandleClass,
	startResize,
	startTitlebarDrag,
} = useWindowChrome();

const boardScopeMode = ref<BoardScopeMode>("all");
const draftScopeMode = ref<ScopeMode>("global");
const editScopeMode = ref<ScopeMode>("global");
const worktrees = ref<WorktreeContext[]>([]);
const selectedWorktreeId = ref<string | null>(null);
const worktreeFilterId = ref<string | null>(null);
const draftTargetWorktreeId = ref("");
const editTargetWorktreeId = ref("");
const newCardOpen = ref(false);
const {
	confirmation,
	confirmAction,
	confirmDialogOpen,
	requestConfirmation,
} = useConfirmation();

const gitBranchLabel = computed(() => {
	if (!snapshot.value?.git.isGitRepo) return null;
	return snapshot.value.git.branch ?? (snapshot.value.git.detached ? "detached" : "git");
});
const currentBranch = computed(() => snapshot.value?.git.branch ?? null);
const canUseBranchScope = computed(() => currentBranch.value != null);
const selectedWorktree = computed(() => (
	worktrees.value.find((worktree) => worktree.id === selectedWorktreeId.value) ?? null
));
const columnOptions = computed<SelectOption[]>(() => (
	snapshot.value?.board.columns.map((column) => ({
		value: column.id,
		label: column.name,
	})) ?? []
));
const draftScopeOptions = computed<SelectOption[]>(() => [
	{
		value: "track",
		label: currentBranch.value ? `Current track: ${currentBranch.value}` : "Current track",
		disabled: !canUseBranchScope.value,
	},
	{ value: "global", label: "Global project" },
]);
const boardScopeOptions = computed<SelectOption[]>(() => [
	{ value: "all", label: "All cards" },
	{ value: "global", label: "Global only" },
]);
const worktreeOptions = computed<SelectOption[]>(() => (
	[
		{ value: "__all__", label: "All worktrees" },
		...worktrees.value.map((worktree) => ({
			value: worktree.id,
			label: worktree.branch ? `${worktree.name} (${worktree.branch})` : worktree.name,
		})),
	]
));
const fieldTypeOptions = computed<SelectOption[]>(() => [
	{ value: "text", label: "Text" },
	{ value: "number", label: "Number" },
	{ value: "checkbox", label: "Checkbox" },
	{ value: "select", label: "Select" },
	{ value: "date", label: "Date" },
]);
const customFields = computed(() => (
	snapshot.value?.metadata.customFields ?? snapshot.value?.board.customFields ?? []
));
const allColumnCardCounts = computed(() => {
	const counts: Record<string, number> = {};
	for (const column of snapshot.value?.board.columns ?? []) {
		counts[column.id] = 0;
	}
	for (const card of snapshot.value?.cards ?? []) {
		counts[card.column] = (counts[card.column] ?? 0) + 1;
	}
	return counts;
});
const editScopeOptions = computed<SelectOption[]>(() => {
	const options: SelectOption[] = [];

	if (editScopeMode.value === "existing" && editingCard.value?.scope.kind === "track") {
		options.push({
			value: "existing",
			label: `Track: ${editingCard.value.scope.ref}`,
		});
	}

	options.push(...draftScopeOptions.value);
	return options;
});
const scopedCards = computed(() => {
	let cards = snapshot.value?.cards ?? [];

	if (worktreeFilterId.value) {
		cards = cards.filter((card) => card.worktreeIds?.includes(worktreeFilterId.value ?? "") ?? false);
	}

	if (boardScopeMode.value === "global") {
		cards = cards.filter((card) => card.scope.kind === "project");
	}

	return cards;
});
const visibleParentCards = computed(() => scopedCards.value.filter((card) => card.parentId == null));

const childProgress = computed(() => {
	const progress: Record<string, ChildProgress> = {};
	for (const card of scopedCards.value) {
		if (!card.parentId) continue;
		progress[card.parentId] ??= { total: 0, done: 0 };
		progress[card.parentId].total += 1;
		if (card.column === "done") progress[card.parentId].done += 1;
	}
	return progress;
});
const editingSubtasks = computed(() => {
	if (!editingCard.value) return [];
	return (snapshot.value?.cards ?? [])
		.filter((card) => card.parentId === editingCard.value?.id)
		.sort((left, right) => left.rank.localeCompare(right.rank));
});
const editingSubtaskProgress = computed(() => {
	if (!editingCard.value) return { total: 0, done: 0 };
	return childProgress.value[editingCard.value.id] ?? { total: 0, done: 0 };
});

const cardsByColumn = computed(() => {
	const grouped = new Map<string, TrackboiCard[]>();
	for (const column of snapshot.value?.board.columns ?? []) {
		grouped.set(column.id, []);
	}
	for (const card of visibleParentCards.value) {
		grouped.get(card.column)?.push(card);
	}
	return grouped;
});

const allEntries = computed<ProjectEntry[]>(() => (
	view.value.sources.flatMap((source) => source.entries)
));
const activeProject = computed<ProjectEntry | null>(() => {
	const id = view.value.activeProjectId;
	if (!id) return null;
	return allEntries.value.find((entry) => entry.projectId === id) ?? null;
});
const canRemoveActiveProject = computed(() => {
	const id = view.value.activeProjectId;
	if (!id) return false;
	return view.value.sources
		.find((source) => source.kind === "manual")
		?.entries.some((entry) => entry.projectId === id) ?? false;
});
const hasProjects = computed(() => allEntries.value.length > 0);
const totalCards = computed(() => snapshot.value?.cards.length ?? 0);
const visibleCardCount = computed(() => visibleParentCards.value.length);
const scopeEmptyMessage = computed(() => {
	if (!snapshot.value || visibleCardCount.value > 0) return null;
	if (worktreeFilterId.value && selectedWorktree.value) {
		return `No cards for ${selectedWorktree.value.name} yet.`;
	}
	if (boardScopeMode.value === "global") {
		return "No global project cards yet.";
	}
	if (totalCards.value === 0) {
		return "No cards yet.";
	}
	return null;
});

function scopeFromMode(mode: ScopeMode): WorkScope {
	if (mode === "existing" && editingCard.value) {
		return editingCard.value.scope;
	}

	if (mode === "track" && currentBranch.value) {
		return { kind: "track", ref: currentBranch.value };
	}

	return { kind: "project", ref: "global" };
}

function scopeModeForCard(card: TrackboiCard): ScopeMode {
	if (card.scope.kind === "project") return "global";
	return card.scope.ref === currentBranch.value ? "track" : "existing";
}

function fieldIdFromName(name: string) {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

	return `${slug || "field"}-${crypto.randomUUID().slice(0, 8)}`;
}

function columnIdFromName(name: string) {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

	return slug || `column-${crypto.randomUUID().slice(0, 8)}`;
}

function setError(errorValue: unknown) {
	error.value = errorValue instanceof Error ? errorValue.message : String(errorValue);
}

function setSnapshot(nextSnapshot: ProjectSnapshot | null) {
	snapshot.value = nextSnapshot;
	draftColumn.value = nextSnapshot?.board.columns[0]?.id ?? "todo";
	draftScopeMode.value = nextSnapshot?.git.branch ? "track" : "global";
	syncBoardDrafts(nextSnapshot);
}

function applyDesktopState(nextState: DesktopState) {
	view.value = nextState.view;
	worktrees.value = nextState.worktrees;
	selectedWorktreeId.value = nextState.selectedWorktreeId;
	draftTargetWorktreeId.value = nextState.selectedWorktreeId ?? "";
	if (worktreeFilterId.value && !nextState.worktrees.some((worktree) => worktree.id === worktreeFilterId.value)) {
		worktreeFilterId.value = null;
	}
	setSnapshot(nextState.snapshot);
}

function syncBoardDrafts(nextSnapshot: ProjectSnapshot | null) {
	boardNameDraft.value = nextSnapshot?.board.name ?? "";
	columnNameDrafts.value = Object.fromEntries(
		nextSnapshot?.board.columns.map((column) => [column.id, column.name]) ?? [],
	);
}

function openNewCard(columnId?: string) {
	editingCard.value = null;
	draftColumn.value = columnId ?? snapshot.value?.board.columns[0]?.id ?? draftColumn.value;
	draftTargetWorktreeId.value = selectedWorktreeId.value ?? "";
	newCardOpen.value = true;
}

function closeNewCard() {
	newCardOpen.value = false;
}

function closeEditingCard() {
	editingCard.value = null;
}

function closeSettings() {
	settingsOpen.value = false;
}

function closeProjectSettings() {
	projectSettingsOpen.value = false;
}

async function refreshDesktopState() {
	applyDesktopState(await desktop.readDesktopState());
}

async function run(action: () => Promise<void>) {
	error.value = null;
	busy.value = true;
	try {
		await action();
	} catch (caught) {
		setError(caught);
	} finally {
		busy.value = false;
	}
}

async function loadProject() {
	loading.value = true;
	error.value = null;
	try {
		await refreshDesktopState();
	} catch (caught) {
		setError(caught);
	} finally {
		loading.value = false;
	}
}

async function chooseProject() {
	await run(async () => {
		await desktop.chooseProject();
		await refreshDesktopState();
	});
}

async function locateProject(projectId: string) {
	await run(async () => {
		await desktop.locateProject(projectId);
		await refreshDesktopState();
	});
}

async function removeProject(projectId: string) {
	const entry = allEntries.value.find((entry) => entry.projectId === projectId);
	if (!entry) return;

	requestConfirmation({
		title: `Remove ${entry.name}?`,
		description: "Trackboi will forget this project, but files on disk will stay where they are.",
		confirmLabel: "Remove",
		destructive: true,
		onConfirm: async () => {
			await run(async () => {
				await desktop.removeProject(projectId);
				await refreshDesktopState();
			});
		},
	});
}

async function addStorageSearchPath() {
	const path = storagePathDraft.value.trim();
	if (!path) return;

	await run(async () => {
		view.value = await desktop.setStorageSearchPaths([...view.value.storageSearchPaths, path]);
		storagePathDraft.value = "";
	});
}

async function removeStorageSearchPath(path: string) {
	if (view.value.storageSearchPaths.length <= 1) {
		setError("Trackboi needs at least one storage search path");
		return;
	}

	await run(async () => {
		view.value = await desktop.setStorageSearchPaths(
			view.value.storageSearchPaths.filter((candidate) => candidate !== path),
		);
	});
}

async function resetStorageSearchPaths() {
	await run(async () => {
		view.value = await desktop.setStorageSearchPaths([".trackboi", ".etc/.trackboi", ".etc/trackboi"]);
	});
}

const activeWorkspaceFile = computed<string | null>(() => {
	const source = view.value.sources.find((source) => source.kind === "codeWorkspace");
	if (!source) return null;
	const filePath = "filePath" in source ? source.filePath : "";
	return filePath && filePath.length > 0 ? filePath : null;
});

async function openWorkspaceFile() {
	await run(async () => {
		const next = await desktop.openWorkspaceFile();
		if (next) view.value = next;
	});
}

async function closeWorkspaceFile() {
	await run(async () => {
		view.value = await desktop.setActiveWorkspaceFile(null);
	});
}

async function switchProject(projectId: string) {
	if (projectId === view.value.activeProjectId) return;

	await run(async () => {
		applyDesktopState(await desktop.switchProject(projectId));
	});
}

async function selectWorktree(worktreeId: string) {
	if (worktreeId === "__all__") {
		worktreeFilterId.value = null;
		return;
	}
	if (worktreeId === selectedWorktreeId.value && worktreeFilterId.value === worktreeId) return;
	await run(async () => {
		applyDesktopState(await desktop.setSelectedWorktree(worktreeId));
		worktreeFilterId.value = worktreeId;
	});
}

async function createNewCard() {
	const title = draftTitle.value.trim();
	if (!title) return;

	await run(async () => {
		await desktop.createCard({
			title,
			description: draftDescription.value,
			column: draftColumn.value,
			scope: scopeFromMode(draftScopeMode.value),
			targetWorktreeId: draftTargetWorktreeId.value || null,
		});
		draftTitle.value = "";
		draftDescription.value = "";
		newCardOpen.value = false;
	});
}

function startEditing(card: TrackboiCard) {
	newCardOpen.value = false;
	editingCard.value = card;
	editDraft.title = card.title;
	editDraft.description = card.description;
	editDraft.column = card.column;
	editFieldValues.value = { ...card.fieldValues };
	editScopeMode.value = scopeModeForCard(card);
	editTargetWorktreeId.value = card.originWorktreeId ?? selectedWorktreeId.value ?? "";
	subtaskTitle.value = "";
}

async function saveEditingCard() {
	if (!editingCard.value) return;
	const cardId = editingCard.value.id;
	const nextColumn = editDraft.column;
	const shouldMove = nextColumn !== editingCard.value.column;

	await run(async () => {
		await desktop.updateCard(cardId, {
			title: editDraft.title,
			description: editDraft.description,
			scope: scopeFromMode(editScopeMode.value),
			fieldValues: editFieldValues.value,
		});
		if (shouldMove) {
			await desktop.moveCard(cardId, nextColumn, null);
		}
		editingCard.value = null;
	});
}

async function addCustomField() {
	const name = fieldNameDraft.value.trim();
	if (!snapshot.value || !name) return;

	const options = fieldTypeDraft.value === "select"
		? fieldOptionsDraft.value
			.split(",")
			.map((option) => option.trim())
			.filter(Boolean)
		: undefined;

	if (fieldTypeDraft.value === "select" && (!options || options.length === 0)) {
		setError("Select fields need at least one comma-separated option");
		return;
	}

	const field: CustomField = {
		id: fieldIdFromName(name),
		name,
		type: fieldTypeDraft.value,
		...(options ? { options } : {}),
	};

	await run(async () => {
		await desktop.updateCustomFields([...customFields.value, field]);
		fieldNameDraft.value = "";
		fieldOptionsDraft.value = "";
	});
}

async function removeCustomField(fieldId: string) {
	if (!snapshot.value) return;

	await run(async () => {
		await desktop.updateCustomFields(customFields.value.filter((field) => field.id !== fieldId));
	});
}

async function updateBoard(nextBoard: ProjectSnapshot["board"]) {
	await run(async () => {
		await desktop.updateBoard(nextBoard);
	});
}

async function saveBoardName() {
	if (!snapshot.value) return;
	const name = boardNameDraft.value.trim();
	if (!name) {
		setError("Board name is required");
		return;
	}

	await updateBoard({
		...snapshot.value.board,
		name,
	});
}

async function addColumn() {
	if (!snapshot.value) return;
	const name = newColumnName.value.trim();
	if (!name) return;

	let id = columnIdFromName(name);
	const existingIds = new Set(snapshot.value.board.columns.map((column) => column.id));
	if (existingIds.has(id)) id = `${id}-${crypto.randomUUID().slice(0, 6)}`;

	await updateBoard({
		...snapshot.value.board,
		columns: [...snapshot.value.board.columns, { id, name }],
	});
	newColumnName.value = "";
}

async function renameColumn(column: Column) {
	if (!snapshot.value) return;
	const name = columnNameDrafts.value[column.id]?.trim();
	if (!name || name === column.name) return;

	await updateBoard({
		...snapshot.value.board,
		columns: snapshot.value.board.columns.map((candidate) => (
			candidate.id === column.id ? { ...candidate, name } : candidate
		)),
	});
}

function removeColumn(column: Column) {
	if (!snapshot.value) return;
	const count = allColumnCardCounts.value[column.id] ?? 0;
	if (count > 0) {
		setError(`Move or delete ${count} cards before removing ${column.name}`);
		return;
	}
	if (snapshot.value.board.columns.length <= 1) {
		setError("Board needs at least one column");
		return;
	}

	requestConfirmation({
		title: `Remove ${column.name}?`,
		description: "This removes the column from the board. Card files are not touched.",
		confirmLabel: "Remove",
		destructive: true,
		onConfirm: async () => {
			if (!snapshot.value) return;
			await updateBoard({
				...snapshot.value.board,
				columns: snapshot.value.board.columns.filter((candidate) => candidate.id !== column.id),
			});
		},
	});
}

async function deleteExistingCard(card: TrackboiCard) {
	requestConfirmation({
		title: `Delete ${card.title}?`,
		description: "This card file will be removed from the Trackboi store.",
		confirmLabel: "Delete",
		destructive: true,
		onConfirm: async () => {
			await run(async () => {
				await desktop.deleteCard(card.id);
				if (editingCard.value?.id === card.id) {
					editingCard.value = null;
				}
			});
		},
	});
}

async function createSubtask() {
	if (!editingCard.value) return;
	const title = subtaskTitle.value.trim();
	if (!title) return;

	const parent = editingCard.value;
	await run(async () => {
		await desktop.createCard({
			title,
			description: "",
			parentId: parent.id,
			column: parent.column,
			scope: parent.scope,
			targetWorktreeId: parent.originWorktreeId ?? selectedWorktreeId.value ?? null,
		});
		subtaskTitle.value = "";
	});
}

async function moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
	await run(async () => {
		await desktop.moveCard(cardId, toColumn, beforeCardId);
	});
}

desktop.addBoardChangedListener(() => {
	void refreshDesktopState();
});

onMounted(loadProject);
</script>

<template>
	<div class="grid h-screen grid-rows-[36px_minmax(0,1fr)] overflow-hidden rounded-[10px] bg-background text-foreground">
		<div
			v-for="edge in resizeEdges"
			:key="edge"
			:class="resizeHandleClass(edge)"
			class="pointer-events-none"
			:style="{ cursor: resizeCursor(edge) }"
			@pointerdown="startResize(edge, $event)"
		/>

		<TitleBar
			:title="snapshot?.project.name ?? 'Trackboi'"
			:branch-label="gitBranchLabel"
			@drag="startTitlebarDrag"
			@toggle-maximize="handleTitlebarDoubleClick"
			@minimize="minimizeWindow"
			@close="closeWindow"
		/>

		<main class="grid h-full min-h-0 grid-cols-[58px_minmax(0,1fr)] items-stretch overflow-hidden">
			<ProjectSidebar
				:view="view"
				:busy="busy"
				@settings="settingsOpen = true"
				@choose-project="chooseProject"
				@switch-project="switchProject"
			/>

			<BoardView
				v-model:board-scope-mode="boardScopeMode"
				:active-project="activeProject"
				:active-workspace-file="activeWorkspaceFile"
				:board-scope-options="boardScopeOptions"
				:branch-label="gitBranchLabel"
				:busy="busy"
				:can-remove-active-project="canRemoveActiveProject"
				:cards-by-column="cardsByColumn"
				:child-progress="childProgress"
				:custom-fields="customFields"
				:error="error"
				:has-projects="hasProjects"
				:loading="loading"
				:worktree-filter-id="worktreeFilterId"
				:scope-empty-message="scopeEmptyMessage"
				:selected-worktree-id="selectedWorktreeId"
				:snapshot="snapshot"
				:visible-card-count="visibleCardCount"
				:worktrees="worktrees"
				:worktree-options="worktreeOptions"
				@choose-project="chooseProject"
				@close-workspace="closeWorkspaceFile"
				@create-card="openNewCard"
				@delete-card="deleteExistingCard"
				@edit-card="startEditing"
				@locate-project="locateProject"
				@move-card="moveCard"
				@open-workspace="openWorkspaceFile"
				@open-new-card="openNewCard()"
				@project-settings="projectSettingsOpen = true"
				@remove-project="removeProject"
				@select-worktree="selectWorktree"
			/>

			<NewCardModal
				v-model:title="draftTitle"
				v-model:description="draftDescription"
				v-model:column="draftColumn"
				v-model:scope-mode="draftScopeMode"
				v-model:target-worktree-id="draftTargetWorktreeId"
				:open="newCardOpen"
				:busy="busy"
				:column-options="columnOptions"
				:scope-options="draftScopeOptions"
				:target-worktree-options="worktreeOptions"
				@close="closeNewCard"
				@create="createNewCard"
			/>

			<EditCardModal
				v-model:draft="editDraft"
				v-model:scope-mode="editScopeMode"
				v-model:field-values="editFieldValues"
				v-model:subtask-title="subtaskTitle"
				v-model:target-worktree-id="editTargetWorktreeId"
				:card="editingCard"
				:busy="busy"
				:column-options="columnOptions"
				:scope-options="editScopeOptions"
				:custom-fields="customFields"
				:subtasks="editingSubtasks"
				:subtask-progress="editingSubtaskProgress"
				:target-worktree-locked="true"
				:target-worktree-options="worktreeOptions"
				@close="closeEditingCard"
				@save="saveEditingCard"
				@delete="deleteExistingCard"
				@edit-subtask="startEditing"
				@create-subtask="createSubtask"
			/>

			<SettingsModal
				v-model:draft="storagePathDraft"
				:open="settingsOpen"
				:paths="view.storageSearchPaths"
				:busy="busy"
				@close="closeSettings"
				@add="addStorageSearchPath"
				@remove="removeStorageSearchPath"
				@reset="resetStorageSearchPaths"
			/>

			<ProjectSettingsModal
				v-model:board-name-draft="boardNameDraft"
				v-model:column-name-drafts="columnNameDrafts"
				v-model:new-column-name="newColumnName"
				v-model:field-name-draft="fieldNameDraft"
				v-model:field-type-draft="fieldTypeDraft"
				v-model:field-options-draft="fieldOptionsDraft"
				:open="projectSettingsOpen"
				:snapshot="snapshot"
				:custom-fields="customFields"
				:column-card-counts="allColumnCardCounts"
				:field-type-options="fieldTypeOptions"
				:busy="busy"
				@close="closeProjectSettings"
				@save-board-name="saveBoardName"
				@rename-column="renameColumn"
				@remove-column="removeColumn"
				@add-column="addColumn"
				@add-custom-field="addCustomField"
				@remove-custom-field="removeCustomField"
			/>
		</main>

		<ConfirmDialog
			v-if="confirmation"
			v-model:open="confirmDialogOpen"
			:title="confirmation.title"
			:description="confirmation.description"
			:confirm-label="confirmation.confirmLabel"
			:destructive="confirmation.destructive"
			@confirm="confirmAction"
		/>
	</div>
</template>

<!--
	Most visual language lives in Tailwind utility classes and the local shadcn-style
	primitives under src/ui/components. Keep bespoke CSS out of this file unless the
	app needs behavior Tailwind cannot express cleanly.
-->
