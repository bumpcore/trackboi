import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { newId } from "@/core/id";
import { desktop } from "@/electron/renderer";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { Confirmation } from "@/ui/viewTypes";
import type { Column, ProjectSnapshot } from "@/core/types";

type ConfirmationRequester = (confirmation: Confirmation) => void;

type ColumnPanelMode = "closed" | "create" | "edit";

type ColumnWorkflow = {
	panelMode: Ref<ColumnPanelMode>;
	selectedColumn: ComputedRef<Column | null>;
	columnNameDraft: Ref<string>;
	insertAfterId: Ref<string>;
	insertAfterOptions: ComputedRef<SelectOption[]>;
	selectedColumnCardCount: ComputedRef<number>;
	openCreateColumn(afterColumnId?: string | null): void;
	openColumn(columnId: string): void;
	closeColumnPanel(): void;
	reorderColumn(columnId: string, beforeColumnId: string | null): Promise<void>;
	submitColumn(): Promise<void>;
	deleteSelectedColumn(): Promise<void>;
};

const INSERT_AT_START_VALUE = "__start__";

function columnIdFromName(name: string) {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

	return slug || newId("column").slice(-8).toLowerCase();
}

function previousColumnId(columns: Column[], columnId: string): string {
	const index = columns.findIndex((column) => column.id === columnId);
	return index > 0 ? columns[index - 1]!.id : INSERT_AT_START_VALUE;
}

function insertColumn(columns: Column[], column: Column, afterColumnId: string): Column[] {
	if (afterColumnId === INSERT_AT_START_VALUE) {
		return [column, ...columns];
	}

	const insertionIndex = columns.findIndex((candidate) => candidate.id === afterColumnId);
	if (insertionIndex === -1) {
		return [...columns, column];
	}

	return [
		...columns.slice(0, insertionIndex + 1),
		column,
		...columns.slice(insertionIndex + 1),
	];
}

function moveColumnBefore(columns: Column[], columnId: string, beforeColumnId: string | null): Column[] {
	const column = columns.find((candidate) => candidate.id === columnId);
	if (!column) return columns;
	const remaining = columns.filter((candidate) => candidate.id !== columnId);
	if (!beforeColumnId) return [...remaining, column];
	const insertionIndex = remaining.findIndex((candidate) => candidate.id === beforeColumnId);
	if (insertionIndex === -1) return [...remaining, column];
	return [
		...remaining.slice(0, insertionIndex),
		column,
		...remaining.slice(insertionIndex),
	];
}

/**
 * Keeps the transient right-pane column workflow isolated from board settings
 * so columns can be created, reordered, renamed, and removed directly from the
 * board surface without pushing more shell state into `App.vue`.
 */
export function useColumnWorkflow(options: {
	snapshot: Ref<ProjectSnapshot | null>;
	columnCardCounts: ComputedRef<Record<string, number>>;
	run(action: () => Promise<void>): Promise<void>;
	setError(errorValue: unknown): void;
	requestConfirmation: ConfirmationRequester;
	replaceBoard(board: ProjectSnapshot["board"]): void;
}): ColumnWorkflow {
	const panelMode = ref<ColumnPanelMode>("closed");
	const selectedColumnId = ref<string | null>(null);
	const columnNameDraft = ref("");
	const insertAfterId = ref(INSERT_AT_START_VALUE);

	const selectedColumn = computed(() => (
		options.snapshot.value?.board.columns.find((column) => column.id === selectedColumnId.value) ?? null
	));
	const selectedColumnCardCount = computed(() => (
		selectedColumn.value ? (options.columnCardCounts.value[selectedColumn.value.id] ?? 0) : 0
	));
	const insertAfterOptions = computed<SelectOption[]>(() => {
		const columns = options.snapshot.value?.board.columns ?? [];
		const candidates = panelMode.value === "edit" && selectedColumn.value
			? columns.filter((column) => column.id !== selectedColumn.value?.id)
			: columns;

		return [
			{ value: INSERT_AT_START_VALUE, label: "At beginning" },
			...candidates.map((column) => ({
				value: column.id,
				label: column.name,
			})),
		];
	});

	watch(
		() => options.snapshot.value,
		(nextSnapshot) => {
			if (panelMode.value === "closed") return;
			if (panelMode.value === "create") {
				const validIds = new Set(nextSnapshot?.board.columns.map((column) => column.id) ?? []);
				if (insertAfterId.value !== INSERT_AT_START_VALUE && !validIds.has(insertAfterId.value)) {
					insertAfterId.value = nextSnapshot?.board.columns.at(-1)?.id ?? INSERT_AT_START_VALUE;
				}
				return;
			}

			const nextColumn = nextSnapshot?.board.columns.find((column) => column.id === selectedColumnId.value) ?? null;
			if (!nextColumn) {
				panelMode.value = "closed";
				selectedColumnId.value = null;
				columnNameDraft.value = "";
				insertAfterId.value = INSERT_AT_START_VALUE;
				return;
			}

			selectedColumnId.value = nextColumn.id;
			columnNameDraft.value = nextColumn.name;
			insertAfterId.value = previousColumnId(nextSnapshot?.board.columns ?? [], nextColumn.id);
		},
		{ immediate: true },
	);

	async function updateBoardColumns(columns: Column[]) {
		if (!options.snapshot.value) return;
		await options.run(async () => {
			options.replaceBoard(await desktop.updateBoard({
				...options.snapshot.value!.board,
				columns,
			}));
		});
	}

	function openCreateColumn(afterColumnId?: string | null) {
		panelMode.value = "create";
		selectedColumnId.value = null;
		columnNameDraft.value = "";
		const columns = options.snapshot.value?.board.columns ?? [];
		const hasRequestedColumn = afterColumnId != null && columns.some((column) => column.id === afterColumnId);
		insertAfterId.value = hasRequestedColumn
			? afterColumnId!
			: (columns.at(-1)?.id ?? INSERT_AT_START_VALUE);
	}

	function openColumn(columnId: string) {
		const column = options.snapshot.value?.board.columns.find((candidate) => candidate.id === columnId) ?? null;
		if (!column) return;
		panelMode.value = "edit";
		selectedColumnId.value = column.id;
		columnNameDraft.value = column.name;
		insertAfterId.value = previousColumnId(options.snapshot.value?.board.columns ?? [], column.id);
	}

	function closeColumnPanel() {
		panelMode.value = "closed";
		selectedColumnId.value = null;
		columnNameDraft.value = "";
		insertAfterId.value = INSERT_AT_START_VALUE;
	}

	async function reorderColumn(columnId: string, beforeColumnId: string | null) {
		const snapshot = options.snapshot.value;
		if (!snapshot) return;
		const nextColumns = moveColumnBefore(snapshot.board.columns, columnId, beforeColumnId);
		if (nextColumns.map((column) => column.id).join("|") === snapshot.board.columns.map((column) => column.id).join("|")) return;
		await updateBoardColumns(nextColumns);
	}

	async function submitColumn() {
		const snapshot = options.snapshot.value;
		const name = columnNameDraft.value.trim();
		if (!snapshot || !name) return;

		if (panelMode.value === "create") {
			let id = columnIdFromName(name);
			const existingIds = new Set(snapshot.board.columns.map((column) => column.id));
			if (existingIds.has(id)) id = `${id}-${newId("column").slice(-6).toLowerCase()}`;
			const nextColumn: Column = { id, name };
			await updateBoardColumns(insertColumn(snapshot.board.columns, nextColumn, insertAfterId.value));
			panelMode.value = "edit";
			selectedColumnId.value = id;
			return;
		}

		const currentColumn = selectedColumn.value;
		if (!currentColumn) return;
		const remainingColumns = snapshot.board.columns.filter((column) => column.id !== currentColumn.id);
		const nextColumn: Column = { ...currentColumn, name };
		await updateBoardColumns(insertColumn(remainingColumns, nextColumn, insertAfterId.value));
	}

	async function deleteSelectedColumn() {
		const snapshot = options.snapshot.value;
		const column = selectedColumn.value;
		if (!snapshot || !column) return;
		const count = options.columnCardCounts.value[column.id] ?? 0;
		if (count > 0) {
			options.setError(`Move or delete ${count} cards before removing ${column.name}`);
			return;
		}
		if (snapshot.board.columns.length <= 1) {
			options.setError("Board needs at least one column");
			return;
		}

		options.requestConfirmation({
			title: `Remove ${column.name}?`,
			description: "This removes the column from the board. Card files are not touched.",
			confirmLabel: "Remove",
			destructive: true,
			onConfirm: async () => {
				await updateBoardColumns(snapshot.board.columns.filter((candidate) => candidate.id !== column.id));
				closeColumnPanel();
			},
		});
	}

	return {
		panelMode,
		selectedColumn,
		columnNameDraft,
		insertAfterId,
		insertAfterOptions,
		selectedColumnCardCount,
		openCreateColumn,
		openColumn,
		closeColumnPanel,
		reorderColumn,
		submitColumn,
		deleteSelectedColumn,
	};
}
