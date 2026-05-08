<script setup lang="ts">
import Sortable, { type SortableEvent } from "sortablejs";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
	FlexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	useVueTable,
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	type Row,
	type SortingState,
} from "@tanstack/vue-table";
import { KanbanSquare, Plus, Search, Table2, X } from "lucide-vue-next";
import type { Card as TrackboiCard, Column, CustomField, FieldValue, ProjectEntry, ProjectSnapshot, Track, WorktreeContext } from "@/core/types";
import BoardColumn from "@/ui/components/BoardColumn.vue";
import BoardTableFilterControl, { type BoardTableFilterKind, type BoardTableFilterValue, type BoardTableRangeFilter } from "@/ui/components/BoardTableFilterControl.vue";
import Button from "@/ui/components/Button.vue";
import UiCard from "@/ui/components/Card.vue";
import Input from "@/ui/components/Input.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { ChildProgress } from "@/ui/viewTypes";

const props = defineProps<{
	activeProject: ProjectEntry | null;
	busy: boolean;
	cardsByColumn: Record<string, TrackboiCard[]>;
	childProgress: Record<string, ChildProgress>;
	customFields: CustomField[];
	error: string | null;
	freshCardIds: Set<string>;
	hasProjects: boolean;
	loading: boolean;
	selectedTrack: Track | null;
	selectedWorktree: WorktreeContext | null;
	snapshot: ProjectSnapshot | null;
	selectedCardId?: string | null;
	trackLabels: Record<string, string>;
	visibleCards: TrackboiCard[];
	visibleCardCount: number;
}>();

const emit = defineEmits<{
	chooseProject: [];
	createCard: [columnId?: string];
	createColumn: [];
	editColumn: [column: Column];
	archiveColumn: [column: Column];
	reorderColumn: [columnId: string, beforeColumnId: string | null];
	clearCardSelection: [];
	selectCard: [card: TrackboiCard];
	editCard: [card: TrackboiCard];
	deleteCard: [card: TrackboiCard];
	archiveCard: [card: TrackboiCard];
	openCardInEditor: [card: TrackboiCard];
	freshSeen: [cardId: string];
	moveCard: [cardId: string, toColumn: string, beforeCardId: string | null];
}>();

const columnsElement = ref<HTMLElement | null>(null);
const viewMode = ref<"board" | "table">("board");
const searchQuery = ref("");
const tableSorting = ref<SortingState>([]);
const tableColumnFilters = ref<ColumnFiltersState>([]);
const moreFiltersOpen = ref(false);
let columnSortable: Sortable | null = null;

type BoardTableRow = {
	card: TrackboiCard;
	title: string;
	description: string;
	columnLabel: string;
	trackLabel: string;
	assignee: string;
	labels: string;
	updatedAt: string;
	searchBlob: string;
	customValues: Record<string, FieldValue>;
};

type BoardTableColumnMeta = {
	filter: {
		kind: BoardTableFilterKind;
		label: string;
		options?: Array<{ value: string; label: string }>;
	};
};

const boardSubtitle = computed(() => {
	if (props.selectedTrack) {
		return `${props.selectedWorktree?.name ?? "Current worktree"} · ${props.selectedTrack.title} · ${props.visibleCardCount} visible cards`;
	}
	if (props.selectedWorktree) {
		return `${props.selectedWorktree.name} · current worktree context · ${props.visibleCardCount} visible cards`;
	}
	return `Current workspace context · ${props.visibleCardCount} visible cards`;
});

const columnLabels = computed<Record<string, string>>(() => (
	Object.fromEntries(props.snapshot?.board.columns.map((column) => [column.id, column.name]) ?? [])
));
const activeColumns = computed(() => props.snapshot?.board.columns.filter((column) => !column.archivedAt) ?? []);

const assigneeOptions = computed(() => uniqueOptions(
	props.visibleCards.map((card) => card.assignee ?? "").filter(Boolean),
));
const labelOptions = computed(() => uniqueOptions(props.visibleCards.flatMap((card) => card.labels)));
const trackOptions = computed(() => uniqueOptions(
	props.visibleCards.map((card) => card.trackId ? props.trackLabels[card.trackId] ?? card.trackId : "Global"),
));

const tableRows = computed<BoardTableRow[]>(() => (
	props.visibleCards.map((card) => {
		const columnLabel = columnLabels.value[card.column] ?? card.column;
		const trackLabel = card.trackId ? props.trackLabels[card.trackId] ?? card.trackId : "Global";
		const labels = card.labels.join(", ");
		return {
			card,
			title: card.title,
			description: card.description,
			columnLabel,
			trackLabel,
			assignee: card.assignee ?? "Unassigned",
			labels,
			updatedAt: card.updatedAt,
			searchBlob: [
				card.title,
				card.description,
				card.id,
				card.column,
				columnLabel,
				trackLabel,
				card.assignee ?? "",
				labels,
				...props.customFields.map((field) => fieldDisplayValue(field, card.fieldValues[field.id])),
			].join(" ").toLowerCase(),
			customValues: card.fieldValues ?? {},
		};
	})
));

const defaultTableColumns = computed<ColumnDef<BoardTableRow>[]>(() => [
	{
		id: "card",
		header: "Card",
		accessorFn: (row) => `${row.title} ${row.description}`,
		filterFn: "textContains",
		meta: filterMeta("search", "Card"),
	},
	{
		id: "column",
		header: "Column",
		accessorFn: (row) => row.columnLabel,
		filterFn: "selectEquals",
		meta: filterMeta("select", "Column", activeColumns.value.map((column) => ({ value: column.name, label: column.name }))),
	},
	{
		id: "track",
		header: "Track",
		accessorFn: (row) => row.trackLabel,
		filterFn: "selectEquals",
		meta: filterMeta("select", "Track", trackOptions.value),
	},
	{
		id: "assignee",
		header: "Assignee",
		accessorFn: (row) => row.assignee,
		filterFn: "selectEquals",
		meta: filterMeta("select", "Assignee", [{ value: "Unassigned", label: "Unassigned" }, ...assigneeOptions.value]),
	},
	{
		id: "labels",
		header: "Labels",
		accessorFn: (row) => row.labels,
		filterFn: labelOptions.value.length > 0 ? "selectEquals" : "textContains",
		meta: filterMeta(labelOptions.value.length > 0 ? "select" : "search", "Labels", labelOptions.value),
	},
	{
		id: "updatedAt",
		header: "Updated",
		accessorFn: (row) => row.updatedAt.slice(0, 10),
		filterFn: "dateRange",
		meta: filterMeta("date", "Updated"),
	},
]);

const tableColumns = computed<ColumnDef<BoardTableRow>[]>(() => [
	...defaultTableColumns.value,
	...props.customFields.map((field): ColumnDef<BoardTableRow> => ({
		id: `field:${field.id}`,
		header: field.name,
		accessorFn: (row) => row.customValues[field.id] ?? null,
		filterFn: filterFnForField(field),
		meta: filterMeta(filterKindForField(field), field.name, optionsForField(field)),
	})),
]);

const table = useVueTable<BoardTableRow>({
	data: tableRows,
	get columns() {
		return tableColumns.value;
	},
	state: {
		get sorting() {
			return tableSorting.value;
		},
		get columnFilters() {
			return tableColumnFilters.value;
		},
		get globalFilter() {
			return searchQuery.value;
		},
	},
	onSortingChange: (updater) => {
		tableSorting.value = typeof updater === "function" ? updater(tableSorting.value) : updater;
	},
	onColumnFiltersChange: (updater) => {
		tableColumnFilters.value = typeof updater === "function" ? updater(tableColumnFilters.value) : updater;
	},
	onGlobalFilterChange: (updater) => {
		searchQuery.value = typeof updater === "function" ? updater(searchQuery.value) : String(updater ?? "");
	},
	globalFilterFn: "globalText",
	filterFns: {
		globalText,
		textContains,
		selectEquals,
		numberRange,
		dateRange,
		booleanEquals,
	},
	getCoreRowModel: getCoreRowModel(),
	getFilteredRowModel: getFilteredRowModel(),
	getSortedRowModel: getSortedRowModel(),
});

const filteredRowCount = computed(() => table.getFilteredRowModel().rows.length);
const activeFilterCount = computed(() => (
	tableColumnFilters.value.filter((filter) => !isEmptyFilterValue(filter.value)).length + (searchQuery.value.trim() ? 1 : 0)
));
const filterableColumns = computed(() => table.getAllLeafColumns().filter((column) => Boolean(filterMetaForColumn(column))));
const trayColumns = computed(() => filterableColumns.value.slice(0, 3));
const moreFilterColumns = computed(() => filterableColumns.value.slice(3));
const filteredCardsByColumn = computed<Record<string, TrackboiCard[]>>(() => {
	const next: Record<string, TrackboiCard[]> = Object.fromEntries(activeColumns.value.map((column) => [column.id, [] as TrackboiCard[]]));
	for (const row of table.getFilteredRowModel().rows) {
		const card = row.original.card;
		next[card.column]?.push(card);
	}
	for (const cards of Object.values(next)) {
		cards.sort((left, right) => left.rank.localeCompare(right.rank));
	}
	return next;
});

function filterMeta(kind: BoardTableFilterKind, label: string, options: Array<{ value: string; label: string }> = []): BoardTableColumnMeta {
	return { filter: { kind, label, options } };
}

function uniqueOptions(values: string[]): Array<{ value: string; label: string }> {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
		.sort((left, right) => left.localeCompare(right))
		.map((value) => ({ value, label: value }));
}

function fieldDisplayValue(field: CustomField, value: FieldValue | undefined): string {
	if (value == null || value === "" || value === false) return "";
	if (field.type === "checkbox") return value === true ? "Checked" : "";
	return String(value);
}

function filterKindForField(field: CustomField): BoardTableFilterKind {
	if (field.type === "number") return "number";
	if (field.type === "date") return "date";
	if (field.type === "checkbox") return "checkbox";
	if (field.type === "select") return "select";
	return "search";
}

function filterFnForField(field: CustomField): string {
	if (field.type === "number") return "numberRange";
	if (field.type === "date") return "dateRange";
	if (field.type === "checkbox") return "booleanEquals";
	if (field.type === "select") return "selectEquals";
	return "textContains";
}

function optionsForField(field: CustomField): Array<{ value: string; label: string }> {
	if (field.type === "select") {
		return (field.options ?? []).map((option) => ({ value: option, label: option }));
	}
	return [];
}

function filterMetaForColumn(column: { columnDef: { meta?: unknown } }): BoardTableColumnMeta["filter"] | null {
	const meta = column.columnDef.meta as BoardTableColumnMeta | undefined;
	return meta?.filter ?? null;
}

function filterValue(columnId: string): BoardTableFilterValue {
	return tableColumnFilters.value.find((filter) => filter.id === columnId)?.value as BoardTableFilterValue;
}

function setFilterValue(columnId: string, value: BoardTableFilterValue) {
	tableColumnFilters.value = [
		...tableColumnFilters.value.filter((filter) => filter.id !== columnId),
		...(isEmptyFilterValue(value) ? [] : [{ id: columnId, value }]),
	];
}

function clearAllTableFilters() {
	searchQuery.value = "";
	tableColumnFilters.value = [];
	moreFiltersOpen.value = false;
}

function isEmptyFilterValue(value: unknown): boolean {
	if (value == null || value === "") return true;
	if (typeof value === "object" && !Array.isArray(value)) {
		const range = value as BoardTableRangeFilter;
		return !range.min && !range.max;
	}
	return false;
}

function globalText(row: Row<BoardTableRow>, _columnId: string, value: unknown): boolean {
	const query = String(value ?? "").trim().toLowerCase();
	return !query || row.original.searchBlob.includes(query);
}

function textContains(row: Row<BoardTableRow>, columnId: string, value: unknown): boolean {
	const query = String(value ?? "").trim().toLowerCase();
	return !query || String(row.getValue(columnId) ?? "").toLowerCase().includes(query);
}

function selectEquals(row: Row<BoardTableRow>, columnId: string, value: unknown): boolean {
	const expected = String(value ?? "");
	if (!expected) return true;
	const current = String(row.getValue(columnId) ?? "");
	return current === expected || current.split(",").map((part) => part.trim()).includes(expected);
}

function numberRange(row: Row<BoardTableRow>, columnId: string, value: unknown): boolean {
	const range = value as BoardTableRangeFilter | undefined;
	if (!range?.min && !range?.max) return true;
	const raw = row.getValue(columnId);
	const numberValue = typeof raw === "number" ? raw : Number(raw);
	if (!Number.isFinite(numberValue)) return false;
	const min = range.min ? Number(range.min) : null;
	const max = range.max ? Number(range.max) : null;
	return (min == null || numberValue >= min) && (max == null || numberValue <= max);
}

function dateRange(row: Row<BoardTableRow>, columnId: string, value: unknown): boolean {
	const range = value as BoardTableRangeFilter | undefined;
	if (!range?.min && !range?.max) return true;
	const dateValue = String(row.getValue(columnId) ?? "").slice(0, 10);
	if (!dateValue) return false;
	return (!range.min || dateValue >= range.min) && (!range.max || dateValue <= range.max);
}

function booleanEquals(row: Row<BoardTableRow>, columnId: string, value: unknown): boolean {
	const expected = String(value ?? "");
	if (!expected) return true;
	return String(row.getValue(columnId) === true) === expected;
}

function forwardMove(cardId: string, toColumn: string, beforeCardId: string | null) {
	emit("moveCard", cardId, toColumn, beforeCardId);
}

function nextColumnIdAfter(item: HTMLElement): string | null {
	let sibling = item.nextElementSibling as HTMLElement | null;
	while (sibling) {
		if (sibling.dataset.boardColumnId) return sibling.dataset.boardColumnId;
		sibling = sibling.nextElementSibling as HTMLElement | null;
	}
	return null;
}

function emitColumnReorder(event: SortableEvent) {
	const item = event.item as HTMLElement | null;
	const columnId = item?.dataset.boardColumnId;
	if (!columnId) return;
	const previousIndex = event.oldDraggableIndex ?? event.oldIndex;
	const nextIndex = event.newDraggableIndex ?? event.newIndex;
	if (previousIndex != null && nextIndex != null && previousIndex === nextIndex) return;
	emit("reorderColumn", columnId, item ? nextColumnIdAfter(item) : null);
}

function mountColumnSortable() {
	if (!columnsElement.value) return;
	columnSortable?.destroy();
	columnSortable = Sortable.create(columnsElement.value, {
		animation: 140,
		direction: "horizontal",
		dataIdAttr: "data-board-column-id",
		draggable: "[data-board-column-id]",
		handle: "[data-column-drag-handle]",
		ghostClass: "column-ghost",
		chosenClass: "column-chosen",
		dragClass: "column-dragging",
		fallbackTolerance: 4,
		filter: "[data-column-sortable-ignore]",
		preventOnFilter: false,
		onEnd: emitColumnReorder,
	});
}

function clearCardSelectionFromBackground(event: PointerEvent) {
	const target = event.target;
	if (!(target instanceof HTMLElement)) return;
	if (target.closest("[data-card-id]")) return;
	emit("clearCardSelection");
}

watch(columnsElement, () => {
	void nextTick(mountColumnSortable);
});

watch(
	() => activeColumns.value.map((column) => column.id).join("|"),
	() => {
		void nextTick(mountColumnSortable);
	},
);

onMounted(() => {
	mountColumnSortable();
});

onBeforeUnmount(() => {
	columnSortable?.destroy();
});
</script>

<template>
	<main class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background focus-visible:outline-none" data-testid="board-workspace" tabindex="-1">
		<header class="border-b border-border/65 px-5 py-4">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Board</div>
					<h1 class="truncate text-[22px] font-semibold tracking-tight text-foreground">
						{{ activeProject?.name ?? snapshot?.project.name ?? "trackboi" }} / {{ snapshot?.board.name ?? "Delivery" }}
					</h1>
					<p class="mt-2 truncate trackboi-mono-font text-[11px] text-muted-foreground">
						{{ boardSubtitle }}
					</p>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<div v-if="snapshot" class="flex border border-border/70 bg-secondary/55">
						<Tooltip content="Board view" side="bottom">
							<Button
								variant="ghost"
								type="button"
								size="icon"
								aria-label="Board view"
								:class="viewMode === 'board' ? 'bg-primary/14 text-foreground' : ''"
								@click="viewMode = 'board'"
							>
								<KanbanSquare class="h-4 w-4" />
							</Button>
						</Tooltip>
						<Tooltip content="Table view" side="bottom">
							<Button
								variant="ghost"
								type="button"
								size="icon"
								aria-label="Table view"
								:class="viewMode === 'table' ? 'bg-primary/14 text-foreground' : ''"
								@click="viewMode = 'table'"
							>
								<Table2 class="h-4 w-4" />
							</Button>
						</Tooltip>
					</div>
					<Tooltip v-if="snapshot" content="New card" side="bottom">
						<Button
							type="button"
							size="icon"
							aria-label="New card"
							:disabled="busy"
							data-testid="board-new-card"
							@click="emit('createCard')"
						>
							<Plus class="h-4 w-4" />
						</Button>
					</Tooltip>
				</div>
			</div>
		</header>

		<div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden py-4">
			<UiCard v-if="error" class="border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
				{{ error }}
			</UiCard>

			<UiCard v-else-if="loading" class="mt-20 ml-5 grid max-w-md gap-2 self-start border-dashed p-8">
				<h2 class="text-xl font-semibold">Loading board</h2>
				<p class="text-sm text-muted-foreground">Looking for the nearest repo and workspace context.</p>
			</UiCard>

			<UiCard v-else-if="!snapshot" class="mt-20 ml-5 grid max-w-md gap-4 self-start border-dashed p-8">
				<div>
					<h2 class="text-xl font-semibold">{{ hasProjects ? "Pick a project" : "Pick a repo" }}</h2>
					<p class="mt-2 text-sm text-muted-foreground">
						trackboi will create a `.trackboi` folder with a starter board.
					</p>
				</div>
				<div class="flex gap-2">
					<Button class="w-fit" type="button" :disabled="busy" @click="emit('chooseProject')">
						Choose project
					</Button>
				</div>
			</UiCard>

			<div v-else-if="snapshot && viewMode === 'board'" class="relative mx-5 mb-3 flex min-w-0 items-center gap-2 border border-border/65 bg-card/35 p-2" data-testid="board-filter-tray">
				<label class="relative block h-7 w-[min(340px,28vw)] min-w-[220px] shrink-0">
					<Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input v-model="searchQuery" class="h-7 rounded-none pl-8 text-[11px]" placeholder="Search board" />
				</label>
				<div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
					<BoardTableFilterControl
						v-for="column in trayColumns"
						:key="column.id"
						:column-id="column.id"
						:label="filterMetaForColumn(column)?.label ?? column.id"
						:kind="filterMetaForColumn(column)?.kind ?? 'search'"
						:options="filterMetaForColumn(column)?.options ?? []"
						:value="filterValue(column.id)"
						compact
						class="w-[160px] shrink-0"
						@update="setFilterValue"
					/>
				</div>
				<p class="trackboi-mono-font shrink-0 text-[11px] text-muted-foreground">{{ filteredRowCount }}/{{ tableRows.length }}</p>
				<div class="flex shrink-0 items-center gap-1">
					<Button
						v-if="moreFilterColumns.length > 0"
						variant="outline"
						type="button"
						size="sm"
						class="rounded-none"
						@click="moreFiltersOpen = !moreFiltersOpen"
					>
						More
					</Button>
					<Tooltip content="Clear filters" side="bottom">
						<Button
							variant="ghost"
							type="button"
							size="icon"
							aria-label="Clear filters"
							:disabled="activeFilterCount === 0"
							@click="clearAllTableFilters"
						>
							<X class="h-4 w-4" />
						</Button>
					</Tooltip>
				</div>
				<div
					v-if="moreFiltersOpen"
					class="absolute right-0 top-[calc(100%+6px)] z-30 grid w-[min(520px,calc(100vw-40px))] gap-3 border border-border/75 bg-popover p-3 text-popover-foreground shadow-2xl"
					data-testid="board-more-filters"
					@pointerdown.stop
				>
					<div class="flex items-center justify-between gap-3 border-b border-border/45 pb-2">
						<p class="trackboi-mono-font text-[11px] uppercase text-muted-foreground">More filters</p>
						<Button variant="ghost" type="button" size="icon" aria-label="Close more filters" @click="moreFiltersOpen = false">
							<X class="h-4 w-4" />
						</Button>
					</div>
					<div class="grid gap-2 sm:grid-cols-2">
						<BoardTableFilterControl
							v-for="column in moreFilterColumns"
							:key="column.id"
							:column-id="column.id"
							:label="filterMetaForColumn(column)?.label ?? column.id"
							:kind="filterMetaForColumn(column)?.kind ?? 'search'"
							:options="filterMetaForColumn(column)?.options ?? []"
							:value="filterValue(column.id)"
							@update="setFilterValue"
						/>
					</div>
				</div>
			</div>

			<div v-if="!error && !loading && snapshot && viewMode === 'board'" class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4">
				<div class="app-scroll min-h-0 overflow-x-auto overflow-y-hidden" @pointerdown="clearCardSelectionFromBackground">
					<div ref="columnsElement" class="grid h-full min-w-max grid-flow-col auto-cols-[356px] items-stretch gap-4 px-5">
						<BoardColumn
							v-for="column in activeColumns"
							:key="column.id"
							:column="column"
							:columns="activeColumns"
							:cards="filteredCardsByColumn[column.id] ?? []"
							:child-progress="childProgress"
							:custom-fields="customFields"
							:fresh-card-ids="freshCardIds"
							:selected-card-id="selectedCardId ?? null"
							:track-labels="trackLabels"
							@move="forwardMove"
							@create="emit('createCard', $event)"
							@edit-column="emit('editColumn', $event)"
							@archive-column="emit('archiveColumn', $event)"
							@select="emit('selectCard', $event)"
							@edit="emit('editCard', $event)"
							@delete="emit('deleteCard', $event)"
							@archive="emit('archiveCard', $event)"
							@open-in-editor="emit('openCardInEditor', $event)"
							@fresh-seen="emit('freshSeen', $event)"
						/>

						<button
							type="button"
							class="group flex h-full min-h-0 flex-col items-center justify-center rounded-[2px] border border-dashed border-border/70 bg-secondary/[0.18] px-6 py-6 text-center transition-colors hover:border-primary/30 hover:bg-secondary/[0.26] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							data-testid="board-add-column"
							@click="emit('createColumn')"
						>
							<span class="font-medium text-foreground">Add a column</span>
							<span class="mt-1 text-sm text-muted-foreground">Expand the board with another workflow step.</span>
						</button>
					</div>
				</div>
			</div>

			<div v-else-if="!error && !loading && snapshot && viewMode === 'table'" class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 px-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<label class="relative block min-w-[280px] max-w-2xl flex-1">
						<Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input v-model="searchQuery" class="h-9 pl-8" placeholder="Search title, notes, id, fields, labels, tracks, and columns" />
					</label>
					<div class="flex items-center gap-2">
						<p class="trackboi-mono-font text-[11px] text-muted-foreground">
							{{ filteredRowCount }} / {{ tableRows.length }} cards
						</p>
						<Tooltip content="Clear filters" side="bottom">
							<Button
								variant="ghost"
								type="button"
								size="icon"
								aria-label="Clear filters"
								:disabled="activeFilterCount === 0"
								@click="clearAllTableFilters"
							>
								<X class="h-4 w-4" />
							</Button>
						</Tooltip>
					</div>
				</div>

				<div class="app-scroll min-h-0 overflow-auto border border-border/65 bg-card/35">
					<table class="w-full min-w-[1040px] border-collapse text-left text-sm">
						<thead class="sticky top-0 z-10 bg-secondary/95 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
							<tr
								v-for="headerGroup in table.getHeaderGroups()"
								:key="headerGroup.id"
							>
								<th
									v-for="header in headerGroup.headers"
									:key="header.id"
									class="min-w-[150px] border-b border-border/65 px-3 py-2 align-top font-medium"
									:class="header.column.id === 'card' ? 'min-w-[360px]' : ''"
								>
									<div class="grid gap-2">
										<button
											v-if="!header.isPlaceholder"
											type="button"
											class="flex w-full items-center justify-between gap-2 text-left transition-colors hover:text-foreground"
											@click="header.column.getToggleSortingHandler()?.($event)"
										>
											<span class="truncate">
												<FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
											</span>
											<span class="trackboi-mono-font text-[10px] text-primary">
												{{ header.column.getIsSorted() === 'asc' ? 'ASC' : header.column.getIsSorted() === 'desc' ? 'DESC' : '' }}
											</span>
										</button>
										<BoardTableFilterControl
											v-if="filterMetaForColumn(header.column)"
											:column-id="header.column.id"
											:label="filterMetaForColumn(header.column)?.label ?? header.column.id"
											:kind="filterMetaForColumn(header.column)?.kind ?? 'search'"
											:options="filterMetaForColumn(header.column)?.options ?? []"
											:value="filterValue(header.column.id)"
											compact
											@update="setFilterValue"
										/>
									</div>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="row in table.getRowModel().rows"
								:key="row.id"
								class="cursor-pointer border-b border-border/45 transition-colors hover:bg-accent/45 focus-within:bg-accent/45"
								:data-card-id="row.original.card.id"
								@click="emit('selectCard', row.original.card)"
								@dblclick="emit('editCard', row.original.card)"
							>
								<td
									v-for="cell in row.getVisibleCells()"
									:key="cell.id"
									class="px-3 py-2 align-top text-muted-foreground"
									:class="cell.column.id === 'card' ? 'max-w-[420px]' : ''"
								>
									<div v-if="cell.column.id === 'card'" class="min-w-0">
										<div class="truncate font-medium text-foreground">{{ row.original.card.title }}</div>
										<div class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{{ row.original.card.description || row.original.card.id }}</div>
									</div>
									<span v-else-if="cell.column.id === 'updatedAt'" class="trackboi-mono-font text-[11px]">
										{{ new Date(row.original.card.updatedAt).toLocaleDateString() }}
									</span>
									<span v-else-if="String(cell.getValue() ?? '')">
										{{ cell.getValue() }}
									</span>
									<span v-else class="text-muted-foreground/55">-</span>
								</td>
							</tr>
							<tr v-if="table.getRowModel().rows.length === 0">
								<td :colspan="table.getAllLeafColumns().length" class="px-3 py-8 text-center text-sm text-muted-foreground">No matching cards.</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</main>
</template>
