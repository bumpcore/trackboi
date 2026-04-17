<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
	AlertTriangle,
	FolderOpen,
	GitBranch,
	HelpCircle,
	ListPlus,
	Maximize2,
	Minus,
	PanelLeft,
	Plus,
	RefreshCw,
	Save,
	Settings,
	Trash2,
	X,
} from "lucide-vue-next";
import BoardColumn from "./components/BoardColumn.vue";
import { desktop } from "@/platform/tauri/desktop";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import UiCard from "@/ui/components/Card.vue";
import Checkbox from "@/ui/components/Checkbox.vue";
import ConfirmDialog from "@/ui/components/ConfirmDialog.vue";
import Input from "@/ui/components/Input.vue";
import Select from "@/ui/components/Select.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import Textarea from "@/ui/components/Textarea.vue";
import type {
	Column,
	CustomField,
	Card as TrackboiCard,
	FieldType,
	FieldValue,
	ProjectIndex,
	ProjectIndexEntry,
	ProjectSnapshot,
	WorkScope,
} from "@/core/types";

const snapshot = ref<ProjectSnapshot | null>(null);
const registry = ref<ProjectIndex>({ projects: [], activeProjectId: null, storageSearchPaths: [] });
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
const editDraft = reactive({
	title: "",
	description: "",
	column: "todo",
});

type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
type BoardScopeMode = "all" | "branch" | "global";
type ScopeMode = "branch" | "global" | "existing";
type Confirmation = {
	title: string;
	description: string;
	confirmLabel: string;
	destructive?: boolean;
	onConfirm: () => void | Promise<void>;
};

const boardScopeMode = ref<BoardScopeMode>("all");
const draftScopeMode = ref<ScopeMode>("global");
const editScopeMode = ref<ScopeMode>("global");
const newCardOpen = ref(false);
const confirmation = ref<Confirmation | null>(null);
const confirmDialogOpen = computed({
	get: () => confirmation.value != null,
	set: (open) => {
		if (!open) confirmation.value = null;
	},
});

const gitBranchLabel = computed(() => {
	if (!snapshot.value?.git.isGitRepo) return null;
	return snapshot.value.git.branch ?? (snapshot.value.git.detached ? "detached" : "git");
});
const gitDirtyLabel = computed(() => {
	if (!snapshot.value?.git.isGitRepo || snapshot.value.git.dirty !== true) return null;
	return "dirty";
});
const currentBranch = computed(() => snapshot.value?.git.branch ?? null);
const canUseBranchScope = computed(() => currentBranch.value != null);
const columnOptions = computed<SelectOption[]>(() => (
	snapshot.value?.board.columns.map((column) => ({
		value: column.id,
		label: column.name,
	})) ?? []
));
const draftScopeOptions = computed<SelectOption[]>(() => [
	{
		value: "branch",
		label: currentBranch.value ? `Current branch: ${currentBranch.value}` : "Current branch",
		disabled: !canUseBranchScope.value,
	},
	{ value: "global", label: "Global project" },
]);
const boardScopeOptions = computed<SelectOption[]>(() => [
	{ value: "all", label: "All cards" },
	{ value: "branch", label: "Current branch", disabled: !currentBranch.value },
	{ value: "global", label: "Global" },
]);
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

	if (editScopeMode.value === "existing" && editingCard.value?.scope.kind === "branch") {
		options.push({
			value: "existing",
			label: `Branch: ${editingCard.value.scope.ref}`,
		});
	}

	options.push(...draftScopeOptions.value);
	return options;
});
const scopedCards = computed(() => {
	const cards = snapshot.value?.cards ?? [];
	const branch = snapshot.value?.git.branch ?? null;

	if (boardScopeMode.value === "branch" && branch) {
		return cards.filter((card) => card.scope.kind === "branch" && card.scope.ref === branch);
	}

	if (boardScopeMode.value === "global") {
		return cards.filter((card) => card.scope.kind === "project");
	}

	return cards;
});
const visibleParentCards = computed(() => scopedCards.value.filter((card) => card.parentId == null));
type ChildProgress = {
	total: number;
	done: number;
};

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

const activeProject = computed(() => (
	registry.value.projects.find((project) => project.id === registry.value.activeProjectId) ?? null
));
const activeProjectInitial = computed(() => (
	(activeProject.value?.name ?? snapshot.value?.project.name ?? "Trackboi").slice(0, 1).toUpperCase()
));
const activeProjectPath = computed(() => activeProject.value?.path ?? snapshot.value?.project.path ?? "Choose a project");
const activeStoragePath = computed(() => activeProject.value?.storagePath ?? snapshot.value?.project.storagePath ?? ".trackboi");
const visibleProjects = computed(() => {
	const seenPaths = new Set<string>();
	return registry.value.projects.filter((project) => {
		if (seenPaths.has(project.path)) return false;
		seenPaths.add(project.path);
		return true;
	});
});
const hasProjects = computed(() => registry.value.projects.length > 0);
const totalCards = computed(() => snapshot.value?.cards.length ?? 0);
const visibleCardCount = computed(() => visibleParentCards.value.length);
const scopeEmptyMessage = computed(() => {
	if (!snapshot.value || visibleCardCount.value > 0) return null;
	if (boardScopeMode.value === "branch" && currentBranch.value) {
		return `No cards scoped to ${currentBranch.value} yet.`;
	}
	if (boardScopeMode.value === "global") {
		return "No global project cards yet.";
	}
	if (totalCards.value === 0) {
		return "No cards yet.";
	}
	return null;
});

function projectInitial(name: string) {
	return name.slice(0, 1).toUpperCase();
}

function statusLabel(status: ProjectIndexEntry["status"]) {
	if (status === "ready") return "Ready";
	if (status === "uninitialized") return "New";
	return "Missing";
}

function statusClass(status: ProjectIndexEntry["status"]) {
	if (status === "ready") return "bg-primary";
	if (status === "uninitialized") return "bg-amber-400";
	return "bg-destructive";
}

function scopeFromMode(mode: ScopeMode): WorkScope {
	if (mode === "existing" && editingCard.value) {
		return editingCard.value.scope;
	}

	if (mode === "branch" && currentBranch.value) {
		return { kind: "branch", ref: currentBranch.value };
	}

	return { kind: "project", ref: "global" };
}

function scopeModeForCard(card: TrackboiCard): ScopeMode {
	if (card.scope.kind === "project") return "global";
	return card.scope.ref === currentBranch.value ? "branch" : "existing";
}

function formatTimestamp(value?: string) {
	if (!value) return "Unknown";

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
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

function selectOptionsForField(field: CustomField): SelectOption[] {
	return (field.options ?? []).map((option) => ({ value: option, label: option }));
}

function fieldTextValue(fieldId: string) {
	const value = editFieldValues.value[fieldId];
	return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function setFieldTextValue(field: CustomField, value: string | number | undefined) {
	const nextValue = value == null ? "" : String(value);
	editFieldValues.value = {
		...editFieldValues.value,
		[field.id]: field.type === "number" ? Number(nextValue) : nextValue,
	};
}

function fieldBooleanValue(fieldId: string) {
	return editFieldValues.value[fieldId] === true;
}

function setFieldBooleanValue(field: CustomField, value: boolean) {
	editFieldValues.value = {
		...editFieldValues.value,
		[field.id]: value,
	};
}

function setError(errorValue: unknown) {
	error.value = errorValue instanceof Error ? errorValue.message : String(errorValue);
}

function setSnapshot(nextSnapshot: ProjectSnapshot | null) {
	snapshot.value = nextSnapshot;
	draftColumn.value = nextSnapshot?.board.columns[0]?.id ?? "todo";
	draftScopeMode.value = nextSnapshot?.git.branch ? "branch" : "global";
	syncBoardDrafts(nextSnapshot);
}

function syncBoardDrafts(nextSnapshot: ProjectSnapshot | null) {
	boardNameDraft.value = nextSnapshot?.board.name ?? "";
	columnNameDrafts.value = Object.fromEntries(
		nextSnapshot?.board.columns.map((column) => [column.id, column.name]) ?? [],
	);
}

function confirmAction() {
	const action = confirmation.value?.onConfirm;
	confirmation.value = null;
	void action?.();
}

function openNewCard(columnId?: string) {
	editingCard.value = null;
	draftColumn.value = columnId ?? snapshot.value?.board.columns[0]?.id ?? draftColumn.value;
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

async function refreshRegistry() {
	registry.value = await desktop.listProjectIndex();
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
		await refreshRegistry();
		setSnapshot(await desktop.getActiveProject());
		await refreshRegistry();
	} catch (caught) {
		setError(caught);
	} finally {
		loading.value = false;
	}
}

async function chooseProject() {
	await run(async () => {
		setSnapshot(await desktop.chooseProject());
		await refreshRegistry();
	});
}

async function locateProject(projectId: string) {
	await run(async () => {
		setSnapshot(await desktop.locateProject(projectId));
		await refreshRegistry();
	});
}

async function removeProject(projectId: string) {
	const project = registry.value.projects.find((project) => project.id === projectId);
	if (!project) return;

	confirmation.value = {
		title: `Remove ${project.name}?`,
		description: "Trackboi will forget this project, but files on disk will stay where they are.",
		confirmLabel: "Remove",
		destructive: true,
		onConfirm: async () => {
			await run(async () => {
				setSnapshot(await desktop.removeProject(projectId));
				await refreshRegistry();
			});
		},
	};
}

async function addStorageSearchPath() {
	const path = storagePathDraft.value.trim();
	if (!path) return;

	await run(async () => {
		registry.value = await desktop.setStorageSearchPaths([...registry.value.storageSearchPaths, path]);
		storagePathDraft.value = "";
	});
}

async function removeStorageSearchPath(path: string) {
	if (registry.value.storageSearchPaths.length <= 1) {
		setError("Trackboi needs at least one storage search path");
		return;
	}

	await run(async () => {
		registry.value = await desktop.setStorageSearchPaths(
			registry.value.storageSearchPaths.filter((candidate) => candidate !== path),
		);
	});
}

async function resetStorageSearchPaths() {
	await run(async () => {
		registry.value = await desktop.setStorageSearchPaths([".trackboi", ".etc/.trackboi", ".etc/trackboi"]);
	});
}

async function switchProject(projectId: string) {
	if (projectId === registry.value.activeProjectId) return;

	await run(async () => {
		setSnapshot(await desktop.switchProject(projectId));
		await refreshRegistry();
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

	confirmation.value = {
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
	};
}

async function deleteExistingCard(card: TrackboiCard) {
	confirmation.value = {
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
	};
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
		});
		subtaskTitle.value = "";
	});
}

async function moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
	await run(async () => {
		await desktop.moveCard(cardId, toColumn, beforeCardId);
	});
}

async function minimizeWindow() {
	await desktop.minimizeWindow();
}

async function toggleMaximizeWindow() {
	await desktop.toggleMaximizeWindow();
}

async function closeWindow() {
	await desktop.closeWindow();
}

function isWindowControlEvent(event: Event) {
	const target = event.target;
	return target instanceof HTMLElement && target.closest("[data-window-control]") != null;
}

function startTitlebarDrag(event: PointerEvent) {
	if (event.button !== 0 || event.detail > 1 || isWindowControlEvent(event)) return;
	event.preventDefault();
	void desktop.startWindowDrag();
}

async function handleTitlebarDoubleClick(event: MouseEvent) {
	if (isWindowControlEvent(event)) return;
	await toggleMaximizeWindow();
}

function resizeCursor(edge: ResizeEdge) {
	if (edge === "n" || edge === "s") return "ns-resize";
	if (edge === "e" || edge === "w") return "ew-resize";
	if (edge === "ne" || edge === "sw") return "nesw-resize";
	return "nwse-resize";
}

function resizeHandleClass(edge: ResizeEdge) {
	const base = "fixed z-50";
	const classes: Record<ResizeEdge, string> = {
		n: "left-3 right-3 top-0 h-2",
		e: "right-0 top-3 bottom-3 w-2",
		s: "left-3 right-3 bottom-0 h-2",
		w: "left-0 top-3 bottom-3 w-2",
		ne: "right-0 top-0 h-4 w-4",
		nw: "left-0 top-0 h-4 w-4",
		se: "right-0 bottom-0 h-4 w-4",
		sw: "left-0 bottom-0 h-4 w-4",
	};

	return `${base} ${classes[edge]}`;
}

async function startResize(edge: ResizeEdge, event: PointerEvent) {
	event.preventDefault();
	await desktop.startResize(edge);
}

desktop.addBoardChangedListener(setSnapshot);

onMounted(loadProject);
</script>

<template>
	<div class="grid h-screen grid-rows-[36px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
		<div
			v-for="edge in (['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[])"
			:key="edge"
			:class="resizeHandleClass(edge)"
			:style="{ cursor: resizeCursor(edge) }"
			@pointerdown="startResize(edge, $event)"
		/>

		<header
			class="grid h-9 grid-cols-[58px_260px_minmax(0,1fr)_112px] border-b border-border/80 bg-card/95 max-lg:grid-cols-[58px_minmax(0,1fr)_112px]"
		>
			<div class="border-r border-border/80" data-tauri-drag-region @pointerdown="startTitlebarDrag" />
			<div
				class="flex items-center gap-2 border-r border-border/80 px-3 max-lg:hidden"
				data-tauri-drag-region
				@pointerdown="startTitlebarDrag"
			>
				<PanelLeft class="h-3.5 w-3.5 text-muted-foreground" />
				<span class="text-xs font-medium text-muted-foreground">Projects</span>
			</div>
			<div
				class="flex items-center justify-between px-4"
				@dblclick="handleTitlebarDoubleClick"
				@pointerdown="startTitlebarDrag"
			>
				<div class="min-w-0">
					<span class="block truncate text-xs font-semibold text-foreground">
						{{ snapshot?.project.name ?? "Trackboi" }}
					</span>
				</div>
				<div class="flex items-center gap-2" data-window-control>
					<Badge v-if="snapshot" variant="secondary">{{ totalCards }} cards</Badge>
					<Badge v-if="gitBranchLabel" variant="outline" class="max-w-48 gap-1.5">
						<GitBranch class="h-3 w-3 shrink-0" />
						<span class="truncate">{{ gitBranchLabel }}</span>
					</Badge>
					<Badge v-if="gitDirtyLabel" variant="outline">{{ gitDirtyLabel }}</Badge>
					<Badge variant="outline">{{ activeStoragePath }}</Badge>
				</div>
			</div>
			<div class="flex items-center justify-end border-l border-border/80 px-1" data-window-control>
				<Button variant="ghost" size="icon" type="button" title="Minimize" @click="minimizeWindow">
					<Minus class="h-4 w-4" />
				</Button>
				<Button variant="ghost" size="icon" type="button" title="Maximize" @click="toggleMaximizeWindow">
					<Maximize2 class="h-3.5 w-3.5" />
				</Button>
				<Button variant="ghost" size="icon" type="button" title="Close" @click="closeWindow">
					<X class="h-4 w-4" />
				</Button>
			</div>
		</header>

		<main class="grid h-full min-h-0 grid-cols-[58px_260px_minmax(0,1fr)] items-stretch overflow-hidden max-lg:grid-cols-[58px_minmax(0,1fr)]">
			<aside class="flex min-h-0 flex-col items-center border-r border-border/80 bg-card/90 py-4">
				<div class="grid h-8 w-8 place-items-center rounded-md bg-primary text-xs font-black text-primary-foreground">
					tb
				</div>

				<div class="mt-5 grid gap-3">
					<button
						v-for="project in visibleProjects"
						:key="project.id"
						class="relative grid h-9 w-9 place-items-center rounded-md border text-sm font-semibold transition"
						:class="project.id === registry.activeProjectId
							? 'border-foreground bg-secondary text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-muted-foreground hover:text-foreground'"
						type="button"
						:title="`${project.name} - ${statusLabel(project.status)}`"
						@click="switchProject(project.id)"
					>
						{{ projectInitial(project.name) }}
						<span
							class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-background"
							:class="statusClass(project.status)"
						/>
					</button>

					<Button variant="ghost" size="icon" type="button" :disabled="busy" title="Add project" @click="chooseProject">
						<Plus class="h-4 w-4" />
					</Button>
				</div>

				<div class="mt-auto grid gap-3">
					<Button variant="ghost" size="icon" type="button" title="Settings" @click="settingsOpen = true">
						<Settings class="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" type="button" title="Help">
						<HelpCircle class="h-4 w-4" />
					</Button>
				</div>
			</aside>

			<aside class="min-h-0 overflow-hidden border-r border-border/80 bg-card/60 px-5 py-5 max-lg:hidden">
				<div class="flex items-start gap-3">
					<div class="grid h-10 w-10 place-items-center rounded-md border border-border bg-secondary text-sm font-semibold">
						{{ activeProjectInitial }}
					</div>
					<div class="min-w-0">
						<h1 class="truncate text-base font-semibold tracking-tight">
							{{ activeProject?.name ?? "Trackboi" }}
						</h1>
						<p class="truncate text-xs text-muted-foreground">
							{{ activeProjectPath }}
						</p>
						<p v-if="activeProject" class="mt-1 truncate text-xs text-muted-foreground">
							{{ activeStoragePath }}
						</p>
					</div>
				</div>

				<div v-if="activeProject" class="mt-4 flex items-center gap-2">
					<Badge variant="secondary" class="gap-1.5">
						<span class="h-1.5 w-1.5 rounded-full" :class="statusClass(activeProject.status)" />
						{{ statusLabel(activeProject.status) }}
					</Badge>
					<Badge v-if="snapshot" variant="outline">{{ totalCards }} cards</Badge>
				</div>

				<div v-if="gitBranchLabel" class="mt-2">
					<Badge variant="outline" class="max-w-full gap-1.5">
						<GitBranch class="h-3 w-3 shrink-0" />
						<span class="truncate">{{ gitBranchLabel }}</span>
					</Badge>
					<Badge v-if="gitDirtyLabel" class="mt-2" variant="outline">{{ gitDirtyLabel }}</Badge>
				</div>

				<Button class="mt-6 w-full" variant="outline" type="button" :disabled="busy" @click="chooseProject">
					<FolderOpen class="h-4 w-4" />
					Add project
				</Button>

				<Button v-if="snapshot" class="mt-2 w-full" type="button" :disabled="busy" @click="openNewCard()">
					<Plus class="h-4 w-4" />
					New card
				</Button>

				<div v-if="activeProject" class="mt-2 grid grid-cols-2 gap-2">
					<Button variant="outline" size="sm" type="button" :disabled="busy" @click="locateProject(activeProject.id)">
						<RefreshCw class="h-3.5 w-3.5" />
						Locate
					</Button>
					<Button variant="outline" size="sm" type="button" :disabled="busy" @click="removeProject(activeProject.id)">
						<Trash2 class="h-3.5 w-3.5" />
						Remove
					</Button>
				</div>

				<Button
					v-if="snapshot"
					class="mt-2 w-full"
					variant="outline"
					type="button"
					:disabled="busy"
					@click="projectSettingsOpen = true"
				>
					<Settings class="h-4 w-4" />
					Project settings
				</Button>
			</aside>

			<section class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden px-6 py-5">
				<header class="mb-5 flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase text-primary">Board</p>
						<h2 class="mt-1 text-2xl font-semibold tracking-tight">
							{{ snapshot?.board.name ?? "No project selected" }}
						</h2>
					</div>
					<div v-if="snapshot" class="flex items-center gap-2">
						<Badge variant="secondary">{{ visibleCardCount }} shown</Badge>
						<Select v-model="boardScopeMode" :options="boardScopeOptions" class="w-40" />
						<Button type="button" :disabled="busy" @click="openNewCard()">
							<Plus class="h-4 w-4" />
							New card
						</Button>
					</div>
				</header>

				<div class="min-h-0 min-w-0 overflow-auto">
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
						<div class="flex flex-wrap gap-2">
							<Button type="button" :disabled="busy" @click="locateProject(activeProject.id)">
								<RefreshCw class="h-4 w-4" />
								Locate folder
							</Button>
							<Button variant="outline" type="button" :disabled="busy" @click="removeProject(activeProject.id)">
								<Trash2 class="h-4 w-4" />
								Remove from Trackboi
							</Button>
						</div>
					</UiCard>

					<UiCard v-else-if="!snapshot" class="mt-20 grid max-w-md gap-4 border-dashed p-8">
						<div>
							<h2 class="text-xl font-semibold">{{ hasProjects ? "Pick a project" : "Pick a repo" }}</h2>
							<p class="mt-2 text-sm text-muted-foreground">
								Trackboi will create a `.trackboi` folder with a starter board.
							</p>
						</div>
						<Button class="w-fit" type="button" :disabled="busy" @click="chooseProject">
							<FolderOpen class="h-4 w-4" />
							Choose project
						</Button>
					</UiCard>

					<div v-else class="flex min-w-max items-start gap-4 pb-5">
						<BoardColumn
							v-for="column in snapshot.board.columns"
							:key="column.id"
							:column="column"
							:cards="cardsByColumn.get(column.id) ?? []"
							:child-progress="childProgress"
							:custom-fields="customFields"
							@move="moveCard"
							@create="openNewCard"
							@edit="startEditing"
							@delete="deleteExistingCard"
						/>
					</div>
					<p v-if="scopeEmptyMessage" class="mt-4 text-sm text-muted-foreground">
						{{ scopeEmptyMessage }}
					</p>
				</div>
			</section>

			<Transition name="surface">
				<div
					v-if="newCardOpen"
					class="fixed inset-x-0 bottom-0 top-9 z-20 bg-background/55 backdrop-blur-[2px]"
					@pointerdown.self="closeNewCard"
				>
					<aside
						class="drawer-panel absolute bottom-0 right-0 top-0 z-10 grid w-[min(420px,94vw)] content-start gap-4 overflow-auto border-l border-border bg-card p-5 shadow-2xl"
					>
					<header class="flex items-start justify-between gap-3">
						<div>
							<p class="text-xs font-semibold uppercase text-primary">New card</p>
							<h2 class="mt-1 text-lg font-semibold">Card details</h2>
						</div>
						<Button variant="ghost" size="icon" type="button" @click="closeNewCard">
							<X class="h-4 w-4" />
						</Button>
					</header>

					<form class="grid gap-4" @submit.prevent="createNewCard">
						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Title
							<Input v-model="draftTitle" autocomplete="off" autofocus placeholder="Ship the first slice" />
						</label>

						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Notes
							<Textarea v-model="draftDescription" rows="8" placeholder="Small enough to move today." />
						</label>

						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Column
							<Select v-model="draftColumn" :options="columnOptions" />
						</label>

						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Scope
							<Select v-model="draftScopeMode" :options="draftScopeOptions" />
						</label>

						<div class="flex gap-2">
							<Button type="submit" :disabled="busy || !draftTitle.trim()">
								<Plus class="h-4 w-4" />
								Add card
							</Button>
							<Button variant="outline" type="button" :disabled="busy" @click="closeNewCard">
								Cancel
							</Button>
						</div>
					</form>
					</aside>
				</div>
			</Transition>

			<Transition name="surface">
				<div
					v-if="editingCard"
					class="fixed inset-x-0 bottom-0 top-9 z-20 bg-background/55 backdrop-blur-[2px]"
					@pointerdown.self="closeEditingCard"
				>
					<aside
						class="drawer-panel absolute bottom-0 right-0 top-0 z-10 grid w-[min(420px,94vw)] content-start gap-4 overflow-auto border-l border-border bg-card p-5 shadow-2xl"
					>
					<header class="flex items-start justify-between gap-3">
						<div>
							<p class="text-xs font-semibold uppercase text-primary">Edit card</p>
							<h2 class="mt-1 text-lg font-semibold">Card details</h2>
						</div>
						<Button variant="ghost" size="icon" type="button" @click="closeEditingCard">
							<X class="h-4 w-4" />
						</Button>
					</header>

					<div class="grid gap-2 rounded-md border border-border bg-background/70 p-3 text-xs text-muted-foreground">
						<div class="flex items-center justify-between gap-3">
							<span>ID</span>
							<span class="min-w-0 truncate font-mono text-foreground">{{ editingCard.id }}</span>
						</div>
						<div class="flex items-center justify-between gap-3">
							<span>Board</span>
							<span class="min-w-0 truncate font-mono text-foreground">{{ editingCard.boardId }}</span>
						</div>
						<div class="flex items-center justify-between gap-3">
							<span>Created</span>
							<span class="text-foreground">{{ formatTimestamp(editingCard.createdAt) }}</span>
						</div>
						<div class="flex items-center justify-between gap-3">
							<span>Updated</span>
							<span class="text-foreground">{{ formatTimestamp(editingCard.updatedAt) }}</span>
						</div>
					</div>

					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Title
						<Input v-model="editDraft.title" autocomplete="off" />
					</label>

					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Notes
						<Textarea v-model="editDraft.description" rows="8" />
					</label>

					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Column
						<Select v-model="editDraft.column" :options="columnOptions" />
					</label>

					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Scope
						<Select v-model="editScopeMode" :options="editScopeOptions" />
					</label>

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
								{{ editingSubtaskProgress.done }}/{{ editingSubtaskProgress.total }}
							</Badge>
						</div>

						<div v-if="editingSubtasks.length > 0" class="grid gap-2">
							<button
								v-for="subtask in editingSubtasks"
								:key="subtask.id"
								class="grid gap-1 rounded-md border border-border bg-card px-3 py-2 text-left transition hover:border-primary/40 hover:bg-secondary/60"
								type="button"
								@click="startEditing(subtask)"
							>
								<span class="text-sm font-medium text-foreground">{{ subtask.title }}</span>
								<span class="text-xs text-muted-foreground">{{ subtask.column }}</span>
							</button>
						</div>

						<form class="flex gap-2" @submit.prevent="createSubtask">
							<Input v-model="subtaskTitle" autocomplete="off" placeholder="Add a subtask" />
							<Button type="submit" :disabled="busy || !subtaskTitle.trim()">
								<Plus class="h-4 w-4" />
								Add
							</Button>
						</form>
					</div>

					<div class="flex gap-2">
						<Button type="button" :disabled="busy || !editDraft.title.trim()" @click="saveEditingCard">
							<Save class="h-4 w-4" />
							Save
						</Button>
						<Button variant="outline" type="button" :disabled="busy" @click="closeEditingCard">
							Cancel
						</Button>
						<Button
							class="ml-auto"
							variant="destructive"
							type="button"
							:disabled="busy"
							@click="deleteExistingCard(editingCard)"
						>
							<Trash2 class="h-4 w-4" />
							Delete
						</Button>
					</div>
					</aside>
				</div>
			</Transition>

			<Transition name="surface">
				<div
					v-if="settingsOpen"
					class="fixed inset-x-0 bottom-0 top-9 z-30 bg-background/55 backdrop-blur-[2px]"
					@pointerdown.self="closeSettings"
				>
					<aside
						class="drawer-panel absolute bottom-0 right-0 top-0 z-10 grid w-[min(420px,94vw)] content-start gap-5 overflow-auto border-l border-border bg-card p-5 shadow-2xl"
					>
					<header class="flex items-start justify-between gap-3">
						<div>
							<p class="text-xs font-semibold uppercase text-primary">Settings</p>
							<h2 class="mt-1 text-lg font-semibold">Storage lookup</h2>
						</div>
						<Button variant="ghost" size="icon" type="button" @click="closeSettings">
							<X class="h-4 w-4" />
						</Button>
					</header>

					<div class="grid gap-2">
						<p class="text-sm text-muted-foreground">
							Trackboi checks these repo-relative paths in order and uses the first database it finds.
						</p>
						<div class="grid gap-2">
							<div
								v-for="path in registry.storageSearchPaths"
								:key="path"
								class="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
							>
								<span class="min-w-0 truncate font-mono text-xs">{{ path }}</span>
								<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="removeStorageSearchPath(path)">
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>

					<form class="grid gap-2" @submit.prevent="addStorageSearchPath">
						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Add path
							<Input v-model="storagePathDraft" autocomplete="off" placeholder=".etc/.trackboi" />
						</label>
						<div class="flex gap-2">
							<Button type="submit" :disabled="busy || !storagePathDraft.trim()">
								<ListPlus class="h-4 w-4" />
								Add path
							</Button>
							<Button variant="outline" type="button" :disabled="busy" @click="resetStorageSearchPaths">
								Reset
							</Button>
						</div>
					</form>

					</aside>
				</div>
			</Transition>

			<Transition name="surface">
				<div
					v-if="projectSettingsOpen"
					class="fixed inset-x-0 bottom-0 top-9 z-30 bg-background/55 backdrop-blur-[2px]"
					@pointerdown.self="closeProjectSettings"
				>
					<aside
						class="drawer-panel absolute bottom-0 right-0 top-0 z-10 grid w-[min(420px,94vw)] content-start gap-5 overflow-auto border-l border-border bg-card p-5 shadow-2xl"
					>
					<header class="flex items-start justify-between gap-3">
						<div>
							<p class="text-xs font-semibold uppercase text-primary">Project settings</p>
							<h2 class="mt-1 text-lg font-semibold">{{ snapshot?.project.name ?? "Project" }}</h2>
						</div>
						<Button variant="ghost" size="icon" type="button" @click="closeProjectSettings">
							<X class="h-4 w-4" />
						</Button>
					</header>

					<div v-if="snapshot" class="grid gap-3">
						<div class="grid gap-3">
							<div>
								<p class="text-xs font-semibold uppercase text-primary">Board</p>
								<p class="mt-1 text-sm text-muted-foreground">
									Name and columns for this board.
								</p>
							</div>

							<form class="flex gap-2" @submit.prevent="saveBoardName">
								<Input v-model="boardNameDraft" autocomplete="off" placeholder="Board name" />
								<Button type="submit" :disabled="busy || !boardNameDraft.trim()">
									<Save class="h-4 w-4" />
									Save
								</Button>
							</form>

							<div class="grid gap-2">
								<div
									v-for="column in snapshot.board.columns"
									:key="column.id"
									class="grid gap-2 rounded-md border border-border bg-background p-3"
								>
									<div class="flex items-center justify-between gap-3">
										<Badge variant="secondary">{{ column.id }}</Badge>
										<Badge variant="outline">{{ allColumnCardCounts[column.id] ?? 0 }} cards</Badge>
									</div>
									<form class="flex gap-2" @submit.prevent="renameColumn(column)">
										<Input v-model="columnNameDrafts[column.id]" autocomplete="off" />
										<Button type="submit" variant="outline" :disabled="busy || !columnNameDrafts[column.id]?.trim()">
											Rename
										</Button>
										<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="removeColumn(column)">
											<Trash2 class="h-4 w-4" />
										</Button>
									</form>
								</div>
							</div>

							<form class="flex gap-2" @submit.prevent="addColumn">
								<Input v-model="newColumnName" autocomplete="off" placeholder="New column" />
								<Button type="submit" :disabled="busy || !newColumnName.trim()">
									<Plus class="h-4 w-4" />
									Add
								</Button>
							</form>
						</div>

						<div class="my-2 border-t border-border" />

						<div>
							<p class="text-xs font-semibold uppercase text-primary">Custom fields</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Fields apply to every card in this project.
							</p>
						</div>

						<div v-if="customFields.length > 0" class="grid gap-2">
							<div
								v-for="field in customFields"
								:key="field.id"
								class="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
							>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-foreground">{{ field.name }}</p>
									<p class="text-xs text-muted-foreground">
										{{ field.type }}{{ field.options?.length ? `: ${field.options.join(", ")}` : "" }}
									</p>
								</div>
								<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="removeCustomField(field.id)">
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>

						<UiCard v-else class="border-dashed p-4 text-sm text-muted-foreground">
							No custom fields yet.
						</UiCard>

						<form class="grid gap-2" @submit.prevent="addCustomField">
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Name
								<Input v-model="fieldNameDraft" autocomplete="off" placeholder="Priority" />
							</label>
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Type
								<Select v-model="fieldTypeDraft" :options="fieldTypeOptions" />
							</label>
							<label v-if="fieldTypeDraft === 'select'" class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Options
								<Input v-model="fieldOptionsDraft" autocomplete="off" placeholder="Low, Medium, High" />
							</label>
							<Button type="submit" :disabled="busy || !fieldNameDraft.trim()">
								<ListPlus class="h-4 w-4" />
								Add field
							</Button>
						</form>
					</div>
					</aside>
				</div>
			</Transition>
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
