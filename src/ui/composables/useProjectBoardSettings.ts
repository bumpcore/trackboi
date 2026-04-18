import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { desktop } from "@/electron/renderer";
import type { Confirmation } from "@/ui/viewTypes";
import type {
	Column,
	CustomField,
	FieldType,
	ProjectSnapshot,
} from "@/core/types";

type ConfirmationRequester = (confirmation: Confirmation) => void;

type ProjectBoardSettings = {
	fieldNameDraft: Ref<string>;
	fieldTypeDraft: Ref<FieldType>;
	fieldOptionsDraft: Ref<string>;
	boardNameDraft: Ref<string>;
	columnNameDrafts: Ref<Record<string, string>>;
	newColumnName: Ref<string>;
	fieldTypeOptions: ComputedRef<Array<{ value: FieldType; label: string }>>;
	customFields: ComputedRef<CustomField[]>;
	saveBoardName(): Promise<void>;
	addColumn(): Promise<void>;
	renameColumn(column: Column): Promise<void>;
	removeColumn(column: Column): void;
	addCustomField(): Promise<void>;
	removeCustomField(fieldId: string): Promise<void>;
};

/**
 * Encapsulates board metadata editing so project settings stay focused on
 * configuration concerns instead of leaking into the app shell.
 */
export function useProjectBoardSettings(options: {
	snapshot: Ref<ProjectSnapshot | null>;
	columnCardCounts: ComputedRef<Record<string, number>>;
	run(action: () => Promise<void>): Promise<void>;
	setError(errorValue: unknown): void;
	requestConfirmation: ConfirmationRequester;
}): ProjectBoardSettings {
	const fieldNameDraft = ref("");
	const fieldTypeDraft = ref<FieldType>("text");
	const fieldOptionsDraft = ref("");
	const boardNameDraft = ref("");
	const columnNameDrafts = ref<Record<string, string>>({});
	const newColumnName = ref("");

	const fieldTypeOptions = computed(() => [
		{ value: "text" as const, label: "Text" },
		{ value: "number" as const, label: "Number" },
		{ value: "checkbox" as const, label: "Checkbox" },
		{ value: "select" as const, label: "Select" },
		{ value: "date" as const, label: "Date" },
	]);
	const customFields = computed(() => (
		options.snapshot.value?.metadata.customFields ?? options.snapshot.value?.board.customFields ?? []
	));

	watch(
		() => options.snapshot.value,
		(nextSnapshot) => {
			boardNameDraft.value = nextSnapshot?.board.name ?? "";
			columnNameDrafts.value = Object.fromEntries(
				nextSnapshot?.board.columns.map((column) => [column.id, column.name]) ?? [],
			);
		},
		{ immediate: true },
	);

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

	async function updateBoard(nextBoard: ProjectSnapshot["board"]) {
		await options.run(async () => {
			await desktop.updateBoard(nextBoard);
		});
	}

	async function saveBoardName() {
		if (!options.snapshot.value) return;
		const name = boardNameDraft.value.trim();
		if (!name) {
			options.setError("Board name is required");
			return;
		}

		await updateBoard({
			...options.snapshot.value.board,
			name,
		});
	}

	async function addColumn() {
		if (!options.snapshot.value) return;
		const name = newColumnName.value.trim();
		if (!name) return;

		let id = columnIdFromName(name);
		const existingIds = new Set(options.snapshot.value.board.columns.map((column) => column.id));
		if (existingIds.has(id)) id = `${id}-${crypto.randomUUID().slice(0, 6)}`;

		await updateBoard({
			...options.snapshot.value.board,
			columns: [...options.snapshot.value.board.columns, { id, name }],
		});
		newColumnName.value = "";
	}

	async function renameColumn(column: Column) {
		if (!options.snapshot.value) return;
		const name = columnNameDrafts.value[column.id]?.trim();
		if (!name || name === column.name) return;

		await updateBoard({
			...options.snapshot.value.board,
			columns: options.snapshot.value.board.columns.map((candidate) => (
				candidate.id === column.id ? { ...candidate, name } : candidate
			)),
		});
	}

	function removeColumn(column: Column) {
		if (!options.snapshot.value) return;
		const count = options.columnCardCounts.value[column.id] ?? 0;
		if (count > 0) {
			options.setError(`Move or delete ${count} cards before removing ${column.name}`);
			return;
		}
		if (options.snapshot.value.board.columns.length <= 1) {
			options.setError("Board needs at least one column");
			return;
		}

		options.requestConfirmation({
			title: `Remove ${column.name}?`,
			description: "This removes the column from the board. Card files are not touched.",
			confirmLabel: "Remove",
			destructive: true,
			onConfirm: async () => {
				if (!options.snapshot.value) return;
				await updateBoard({
					...options.snapshot.value.board,
					columns: options.snapshot.value.board.columns.filter((candidate) => candidate.id !== column.id),
				});
			},
		});
	}

	async function addCustomField() {
		const name = fieldNameDraft.value.trim();
		if (!options.snapshot.value || !name) return;

		const fieldOptions = fieldTypeDraft.value === "select"
			? fieldOptionsDraft.value
				.split(",")
				.map((option) => option.trim())
				.filter(Boolean)
			: undefined;

		if (fieldTypeDraft.value === "select" && (!fieldOptions || fieldOptions.length === 0)) {
			options.setError("Select fields need at least one comma-separated option");
			return;
		}

		const field: CustomField = {
			id: fieldIdFromName(name),
			name,
			type: fieldTypeDraft.value,
			...(fieldOptions ? { options: fieldOptions } : {}),
		};

		await options.run(async () => {
			await desktop.updateCustomFields([...customFields.value, field]);
			fieldNameDraft.value = "";
			fieldOptionsDraft.value = "";
		});
	}

	async function removeCustomField(fieldId: string) {
		if (!options.snapshot.value) return;

		await options.run(async () => {
			await desktop.updateCustomFields(customFields.value.filter((field) => field.id !== fieldId));
		});
	}

	return {
		fieldNameDraft,
		fieldTypeDraft,
		fieldOptionsDraft,
		boardNameDraft,
		columnNameDrafts,
		newColumnName,
		fieldTypeOptions,
		customFields,
		saveBoardName,
		addColumn,
		renameColumn,
		removeColumn,
		addCustomField,
		removeCustomField,
	};
}
