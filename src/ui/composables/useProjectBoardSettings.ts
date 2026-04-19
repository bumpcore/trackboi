import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { newId } from "@/core/id";
import { desktop } from "@/electron/renderer";
import type { Confirmation } from "@/ui/viewTypes";
import type {
	BoardDescriptor,
	Column,
	CustomField,
	FieldType,
	PersonAlias,
	ProjectSnapshot,
} from "@/core/types";

type ConfirmationRequester = (confirmation: Confirmation) => void;

type ProjectBoardSettings = {
	fieldNameDraft: Ref<string>;
	fieldTypeDraft: Ref<FieldType>;
	fieldOptionsDraft: Ref<string>;
	boardCreateNameDraft: Ref<string>;
	boardNameDraft: Ref<string>;
	columnNameDrafts: Ref<Record<string, string>>;
	newColumnName: Ref<string>;
	personDisplayNameDraft: Ref<string>;
	personEmailsDraft: Ref<string>;
	personNamesDraft: Ref<string>;
	fieldTypeOptions: ComputedRef<Array<{ value: FieldType; label: string }>>;
	boards: ComputedRef<BoardDescriptor[]>;
	customFields: ComputedRef<CustomField[]>;
	people: ComputedRef<PersonAlias[]>;
	selectBoard(boardId: string): Promise<void>;
	createBoard(): Promise<void>;
	deleteBoard(boardId: string): Promise<void>;
	saveBoardName(): Promise<void>;
	addColumn(nameOverride?: string): Promise<void>;
	renameColumn(column: Column): Promise<void>;
	removeColumn(column: Column): void;
	addCustomField(): Promise<void>;
	removeCustomField(fieldId: string): Promise<void>;
	addPersonAlias(): Promise<void>;
	removePersonAlias(personId: string): Promise<void>;
};

/**
 * Encapsulates board metadata editing so project settings stay focused on
 * configuration concerns instead of leaking into the app shell.
 */
export function useProjectBoardSettings(options: {
	snapshot: Ref<ProjectSnapshot | null>;
	columnCardCounts: ComputedRef<Record<string, number>>;
	run(action: () => Promise<void>): Promise<void>;
	refreshDesktopState(): Promise<void>;
	setError(errorValue: unknown): void;
	requestConfirmation: ConfirmationRequester;
}): ProjectBoardSettings {
	const fieldNameDraft = ref("");
	const fieldTypeDraft = ref<FieldType>("text");
	const fieldOptionsDraft = ref("");
	const boardCreateNameDraft = ref("");
	const boardNameDraft = ref("");
	const columnNameDrafts = ref<Record<string, string>>({});
	const newColumnName = ref("");
	const personDisplayNameDraft = ref("");
	const personEmailsDraft = ref("");
	const personNamesDraft = ref("");

	const fieldTypeOptions = computed(() => [
		{ value: "text" as const, label: "Text" },
		{ value: "number" as const, label: "Number" },
		{ value: "checkbox" as const, label: "Checkbox" },
		{ value: "select" as const, label: "Select" },
		{ value: "date" as const, label: "Date" },
	]);
	const customFields = computed(() => options.snapshot.value?.board.customFields ?? []);
	const people = computed(() => options.snapshot.value?.metadata.people ?? []);
	const boards = computed(() => options.snapshot.value?.boards ?? []);

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

		return `${slug || "field"}-${newId("field").slice(-8)}`;
	}

	function columnIdFromName(name: string) {
		const slug = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");

		return slug || `column-${newId("column").slice(-8)}`;
	}

	async function updateBoard(nextBoard: ProjectSnapshot["board"]) {
		await options.run(async () => {
			await desktop.updateBoard(nextBoard);
			await options.refreshDesktopState();
		});
	}

	async function selectBoard(boardId: string) {
		if (!options.snapshot.value || options.snapshot.value.board.id === boardId) return;
		await options.run(async () => {
			await desktop.setActiveBoard(boardId);
			await options.refreshDesktopState();
		});
	}

	async function createBoard() {
		const name = boardCreateNameDraft.value.trim();
		if (!name) return;
		await options.run(async () => {
			await desktop.createBoard({ name });
			boardCreateNameDraft.value = "";
			await options.refreshDesktopState();
		});
	}

	async function deleteBoard(boardId: string) {
		const board = boards.value.find((candidate) => candidate.id === boardId);
		if (!board) return;

		options.requestConfirmation({
			title: `Remove ${board.name}?`,
			description: "This removes the board record. Cards and tracks must be moved out first.",
			confirmLabel: "Remove",
			destructive: true,
			onConfirm: async () => {
				await options.run(async () => {
					await desktop.deleteBoard(boardId);
					await options.refreshDesktopState();
				});
			},
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

	/**
	 * Adds a new board column. The shell can provide an override name for
	 * lightweight affordances such as the ghost add-column lane.
	 */
	async function addColumn(nameOverride?: string) {
		if (!options.snapshot.value) return;
		const trimmedOverride = nameOverride?.trim();
		const name = trimmedOverride || newColumnName.value.trim();
		if (!name) return;

		let id = columnIdFromName(name);
		const existingIds = new Set(options.snapshot.value.board.columns.map((column) => column.id));
		if (existingIds.has(id)) id = `${id}-${newId("column").slice(-6)}`;

		await updateBoard({
			...options.snapshot.value.board,
			columns: [...options.snapshot.value.board.columns, { id, name }],
		});
		if (!trimmedOverride) newColumnName.value = "";
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

		await updateBoard({
			...options.snapshot.value.board,
			customFields: [...customFields.value, field],
		});
		fieldNameDraft.value = "";
		fieldOptionsDraft.value = "";
	}

	async function removeCustomField(fieldId: string) {
		if (!options.snapshot.value) return;
		await updateBoard({
			...options.snapshot.value.board,
			customFields: customFields.value.filter((field) => field.id !== fieldId),
		});
	}

	async function addPersonAlias() {
		if (!options.snapshot.value) return;
		const displayName = personDisplayNameDraft.value.trim();
		if (!displayName) return;

		const nextPerson: PersonAlias = {
			id: newId("person"),
			displayName,
			gitEmails: personEmailsDraft.value
				.split(",")
				.map((value) => value.trim().toLowerCase())
				.filter(Boolean),
			gitNames: personNamesDraft.value
				.split(",")
				.map((value) => value.trim())
				.filter(Boolean),
		};

		await options.run(async () => {
			await desktop.updateProjectPeople([...people.value, nextPerson]);
			personDisplayNameDraft.value = "";
			personEmailsDraft.value = "";
			personNamesDraft.value = "";
			await options.refreshDesktopState();
		});
	}

	async function removePersonAlias(personId: string) {
		await options.run(async () => {
			await desktop.updateProjectPeople(people.value.filter((person) => person.id !== personId));
			await options.refreshDesktopState();
		});
	}

	return {
		fieldNameDraft,
		fieldTypeDraft,
		fieldOptionsDraft,
		boardCreateNameDraft,
		boardNameDraft,
		columnNameDrafts,
		newColumnName,
		personDisplayNameDraft,
		personEmailsDraft,
		personNamesDraft,
		fieldTypeOptions,
		boards,
		customFields,
		people,
		selectBoard,
		createBoard,
		deleteBoard,
		saveBoardName,
		addColumn,
		renameColumn,
		removeColumn,
		addCustomField,
		removeCustomField,
		addPersonAlias,
		removePersonAlias,
	};
}
