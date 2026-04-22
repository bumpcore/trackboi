<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BoardSettingsModal from "@/ui/components/BoardSettingsModal.vue";
import BoardWorkspace from "@/ui/components/BoardWorkspace.vue";
import CommandCenter from "@/ui/components/CommandCenter.vue";
import ConfirmDialog from "@/ui/components/ConfirmDialog.vue";
import LeftRail from "@/ui/components/LeftRail.vue";
import LeftWorkspacePanel from "@/ui/components/LeftWorkspacePanel.vue";
import PanelResizer from "@/ui/components/PanelResizer.vue";
import ProjectSettingsModal from "@/ui/components/ProjectSettingsModal.vue";
import RightWorkspacePanel from "@/ui/components/RightWorkspacePanel.vue";
import SettingsModal from "@/ui/components/SettingsModal.vue";
import WorkspaceTitleBar from "@/ui/components/WorkspaceTitleBar.vue";
import { desktop } from "@/electron/renderer";
import { useBoardPresentationState } from "@/ui/composables/useBoardPresentationState";
import { useAppPreferences } from "@/ui/composables/useAppPreferences";
import { useCardWorkflow } from "@/ui/composables/useCardWorkflow";
import { useColumnWorkflow } from "@/ui/composables/useColumnWorkflow";
import { useCommandCenter } from "@/ui/composables/useCommandCenter";
import { useConfirmation } from "@/ui/composables/useConfirmation";
import { useDesktopProjectState } from "@/ui/composables/useDesktopProjectState";
import { useFreshCardHighlights } from "@/ui/composables/useFreshCardHighlights";
import { useGlobalAppSettings } from "@/ui/composables/useGlobalAppSettings";
import { usePanelShortcuts } from "@/ui/composables/usePanelShortcuts";
import { useProjectBoardSettings } from "@/ui/composables/useProjectBoardSettings";
import { useThemeMode } from "@/ui/composables/useThemeMode";
import { useTrackWorkflow } from "@/ui/composables/useTrackWorkflow";
import { useWindowChrome } from "@/ui/composables/useWindowChrome";
import { useWorkspaceShellState } from "@/ui/composables/useWorkspaceShellState";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { BoardScopeMode, CommandCenterItem, RightPanelView } from "@/ui/viewTypes";

const {
	closeWindow,
	handleTitlebarDoubleClick,
	minimizeWindow,
	resizeCursor,
	resizeEdges,
	resizeHandleClass,
	startResize: startWindowResize,
	startTitlebarDrag,
} = useWindowChrome();

const {
	confirmation,
	confirmAction,
	confirmDialogOpen,
	requestConfirmation,
} = useConfirmation();

const boardScopeMode = ref<BoardScopeMode>("all");

const {
	snapshot,
	view,
	worktrees,
	selectedWorktreeId,
	selectedBoardId,
	loading,
	busy,
	error,
	settingsOpen,
	projectSettingsOpen,
	storagePathDraft,
	run,
	setError,
	loadProject,
	chooseProject,
	addStorageSearchPath,
	removeStorageSearchPath,
	resetStorageSearchPaths,
	switchProject,
	selectWorktree,
	selectBoard: selectBoardContext,
	replaceSnapshot,
	replaceBoard,
	replaceMetadata,
	upsertTrack,
	removeTrack,
	updateTrackFile,
	removeTrackFile,
	upsertCard,
	removeCard,
	addCardComment,
	optimisticMoveCard,
	closeSettings,
	openProjectSettings,
	closeProjectSettings,
	activeProject,
	allEntries,
	hasProjects,
	selectedWorktree,
	gitBranchLabel,
	currentBranch,
} = useDesktopProjectState(requestConfirmation);

const {
	selectedTrackId,
	panelMode: trackPanelMode,
	selectedTrackFileName,
	selectedTrackFileContent,
	tracks,
	selectedTrack,
	linkedTrackCards,
	trackLabels,
	cardTrackOptions,
	clearTrackSelection,
	selectTrack,
	openCreateTrack,
	saveTrack,
	deleteSelectedTrack,
	loadSelectedTrackFile,
	writeSelectedTrackFile,
	deleteSelectedTrackFile,
} = useTrackWorkflow({
	snapshot,
	boardScopeMode,
	run,
	requestConfirmation,
	upsertTrack,
	removeTrack,
	updateTrackFile,
	removeTrackFile,
});

const {
	panelMode: cardPanelMode,
	selectedCard,
	draft,
	trackId,
	fieldValues,
	commentBody,
	subtaskTitle,
	openCreateCard,
	selectCard,
	openCard,
	submitCard,
	addComment,
	deleteCard,
	createSubtask,
	closeCardPanel,
} = useCardWorkflow({
	snapshot,
	selectedTrackId,
	run,
	requestConfirmation,
	upsertCard,
	removeCard,
	addCardComment,
});

const {
	allColumnCardCounts,
	cardsByColumn,
	childProgress,
	editingSubtasks,
	editingSubtaskProgress,
	visibleCardCount,
	scopeEmptyMessage,
} = useBoardPresentationState({
	snapshot,
	boardScopeMode,
	selectedTrack,
	selectedTrackId,
	selectedWorktree,
	editingCardId: computed(() => selectedCard.value?.id ?? null),
});

const { freshCardIds, clearFreshCard } = useFreshCardHighlights(snapshot);

const {
	boardCreateNameDraft,
	fieldNameDraft,
	fieldTypeDraft,
	fieldOptionsDraft,
	boardNameDraft,
	boards,
	personDisplayNameDraft,
	personEmailsDraft,
	personNamesDraft,
	fieldTypeOptions,
	customFields,
	people,
	selectBoard,
	createBoard,
	deleteBoard,
	saveBoardName,
	addCustomField,
	removeCustomField,
	addPersonAlias,
	removePersonAlias,
} = useProjectBoardSettings({
	snapshot,
	run,
	setError,
	requestConfirmation,
	replaceSnapshot,
	replaceBoard,
	replaceMetadata,
	selectBoard: selectBoardContext,
});

const {
	panelMode: columnPanelMode,
	selectedColumn,
	columnNameDraft,
	insertAfterId: columnInsertAfterId,
	insertAfterOptions: columnInsertAfterOptions,
	selectedColumnCardCount,
	openCreateColumn,
	openColumn,
	closeColumnPanel,
	submitColumn,
	deleteSelectedColumn,
} = useColumnWorkflow({
	snapshot,
	columnCardCounts: allColumnCardCounts,
	run,
	setError,
	requestConfirmation,
	replaceBoard,
});

const boardSettingsOpen = ref(false);
const agentNameDraft = ref("");
const agentDescriptionDraft = ref("");

const {
	appSettings,
	detectedEditors,
	registerAgent,
	removeAgent,
	updateEditorPreference,
} = useGlobalAppSettings();

const shell = useWorkspaceShellState();
const {
	leftPanelShortcut,
	rightPanelShortcut,
	commandCenterNavigateShortcut,
	commandCenterCommandShortcut,
	themeMode,
	resetPanelShortcuts,
	resetThemeMode,
} = useAppPreferences();

const columnOptions = computed<SelectOption[]>(() => (
	snapshot.value?.board.columns.map((column) => ({
		value: column.id,
		label: column.name,
	})) ?? []
));

const trackCounts = computed<Record<string, number>>(() => {
	const counts: Record<string, number> = {};
	for (const track of tracks.value) counts[track.id] = 0;
	for (const card of snapshot.value?.cards ?? []) {
		if (!card.parentId && card.trackId) counts[card.trackId] = (counts[card.trackId] ?? 0) + 1;
	}
	return counts;
});

const selectedCardTrack = computed(() => {
	if (!selectedCard.value?.trackId) return null;
	return snapshot.value?.tracks.find((track) => track.id === selectedCard.value?.trackId) ?? null;
});

const actorLabels = computed<Record<string, string>>(() => {
	const labels: Record<string, string> = {};
	for (const person of snapshot.value?.metadata.people ?? []) labels[person.id] = person.displayName;
	for (const agent of appSettings.value.agents) labels[agent.id] = agent.name;
	return labels;
});
const boardNameById = computed<Record<string, string>>(() => Object.fromEntries(
	boards.value.map((board) => [board.id, board.name]),
));
const columnNameById = computed<Record<string, string>>(() => Object.fromEntries(
	(snapshot.value?.board.columns ?? []).map((column) => [column.id, column.name]),
));

const shellGridStyle = computed(() => ({
	gridTemplateColumns: `56px ${shell.leftPanelWidth.value}px minmax(0,1fr) ${shell.rightPanelWidth.value}px`,
}));

const leftResizerStyle = computed(() => ({
	left: `${56 + shell.leftPanelWidth.value}px`,
}));

const rightResizerStyle = computed(() => ({
	left: `calc(100% - ${shell.rightPanelWidth.value}px)`,
}));

function setRightView(view: RightPanelView) {
	if (shell.rightCollapsed.value) shell.rightCollapsed.value = false;
	shell.setRightView(view);
}

function ensureRightPanelOpen() {
	if (shell.rightCollapsed.value) shell.rightCollapsed.value = false;
}

function openSettings() {
	settingsOpen.value = true;
}

function focusTrack(trackId: string) {
	selectTrack(trackId);
	ensureRightPanelOpen();
	shell.setRightView("track");
}

function openCardPanel(columnId?: string) {
	openCreateCard(columnId);
	ensureRightPanelOpen();
	shell.setRightView("card");
}

function editCard(card: Parameters<typeof openCard>[0]) {
	openCard(card);
	ensureRightPanelOpen();
	shell.setRightView("card");
}

function selectCardFromBoard(card: Parameters<typeof openCard>[0]) {
	selectCard(card);
}

function openTrackPanel(trackId: string) {
	focusTrack(trackId);
}

function handleTrackSelection(trackId: string) {
	if (trackId === "__all__") {
		clearTrackSelection();
		return;
	}
	openTrackPanel(trackId);
}

function createTrackFromShell() {
	openCreateTrack();
	ensureRightPanelOpen();
	shell.setRightView("track");
}

function openCreateColumnPanel(afterColumnId?: string | null) {
	openCreateColumn(afterColumnId);
	ensureRightPanelOpen();
	shell.setRightView("column");
}

function openColumnPanel(columnId: string) {
	openColumn(columnId);
	ensureRightPanelOpen();
	shell.setRightView("column");
}

function openBoardSettings() {
	boardSettingsOpen.value = true;
}

function closeBoardSettings() {
	boardSettingsOpen.value = false;
}

async function focusBoard(boardId: string) {
	await selectBoard(boardId);
}

async function focusCard(cardId: string, boardId?: string) {
	if (boardId && snapshot.value?.board.id !== boardId) await focusBoard(boardId);
	const nextCard = snapshot.value?.cards.find((candidate) => candidate.id === cardId);
	if (nextCard) editCard(nextCard);
}

async function focusTrackById(trackId: string, boardId?: string) {
	if (boardId && snapshot.value?.board.id !== boardId) await focusBoard(boardId);
	focusTrack(trackId);
}

const commandCenterItems = computed<CommandCenterItem[]>(() => {
	const items: CommandCenterItem[] = [];

	for (const entry of allEntries.value) {
		items.push({
			id: `project:${entry.projectPath}`,
			mode: "navigate",
			kind: "project",
			section: "Workspaces",
			title: entry.name,
			subtitle: entry.branch ? `${entry.path} · ${entry.branch}` : entry.path,
			keywords: [entry.projectPath, entry.status, entry.branch ?? ""],
			run: async () => {
				await switchProject(entry.projectPath);
			},
		});
	}

	for (const worktree of worktrees.value) {
		items.push({
			id: `worktree:${worktree.id}`,
			mode: "navigate",
			kind: "worktree",
			section: "Worktrees",
			title: worktree.name,
			subtitle: worktree.branch ? `${worktree.branch} · ${worktree.path}` : worktree.path,
			keywords: [worktree.path, worktree.branch ?? "", worktree.status],
			run: async () => {
				await selectWorktree(worktree.id);
			},
		});
	}

	for (const board of boards.value) {
		items.push({
			id: `board:${board.id}`,
			mode: "navigate",
			kind: "board",
			section: "Boards",
			title: board.name,
			subtitle: board.status === "stale" ? "Stale in the selected worktree" : "Ready in the selected worktree",
			keywords: [board.status, ...board.worktreeIds],
			run: async () => {
				await focusBoard(board.id);
			},
		});
	}

	for (const track of tracks.value) {
		items.push({
			id: `track:${track.id}`,
			mode: "navigate",
			kind: "track",
			section: "Tracks",
			title: track.title,
			subtitle: [
				boardNameById.value[track.boardId] ?? "Board",
				track.source.kind === "branch" ? track.source.ref : "manual track",
			].join(" · "),
			keywords: [track.slug, track.summary, track.plan, track.boardId],
			run: async () => {
				await focusTrackById(track.id, track.boardId);
			},
		});
	}

	for (const card of snapshot.value?.cards ?? []) {
		items.push({
			id: `card:${card.id}`,
			mode: "navigate",
			kind: "card",
			section: "Cards",
			title: card.title,
			subtitle: [
				boardNameById.value[card.boardId] ?? "Board",
				columnNameById.value[card.column] ?? card.column,
				card.trackId ? trackLabels.value[card.trackId] ?? "linked track" : "untracked",
			].join(" · "),
			keywords: [card.description, card.boardId, card.column, card.trackId ?? ""],
			run: async () => {
				await focusCard(card.id, card.boardId);
			},
		});
	}

	for (const card of snapshot.value?.cards ?? []) {
		for (const comment of card.comments) {
			const body = comment.body
				.replace(/\s+/g, " ")
				.trim();
			const preview = body.length > 88 ? `${body.slice(0, 88).trimEnd()}…` : body;
			items.push({
				id: `comment:${comment.id}`,
				mode: "navigate",
				kind: "comment",
				section: "Comments",
				title: preview || `Comment on ${card.title}`,
				subtitle: `${card.title} · ${boardNameById.value[card.boardId] ?? "Board"}`,
				keywords: [comment.body, card.title, card.id, card.boardId],
				run: async () => {
					await focusCard(card.id, card.boardId);
				},
			});
		}
	}

	items.push(
		{
			id: "command:settings",
			mode: "command",
			kind: "command",
			section: "Workspace",
			title: "Open settings",
			subtitle: "Show app preferences, shortcuts, agents, and editor settings",
			keywords: ["preferences", "app settings", "shortcuts"],
			icon: "settings",
			run: openSettings,
		},
		{
			id: "command:choose-project",
			mode: "command",
			kind: "command",
			section: "Workspace",
			title: "Add project",
			subtitle: "Choose a repository or folder to register as a workspace",
			keywords: ["choose project", "workspace", "open folder"],
			icon: "chooseProject",
			run: async () => {
				await chooseProject();
			},
		},
		{
			id: "command:create-card",
			mode: "command",
			kind: "command",
			section: "Create",
			title: "Create card",
			subtitle: "Open the card workflow in the right panel",
			keywords: ["new card", "task"],
			icon: "createCard",
			run: () => {
				openCardPanel();
			},
		},
		{
			id: "command:create-track",
			mode: "command",
			kind: "command",
			section: "Create",
			title: "Create track",
			subtitle: "Start a new track in the right panel",
			keywords: ["new track"],
			icon: "createTrack",
			run: createTrackFromShell,
		},
		{
			id: "command:toggle-left-panel",
			mode: "command",
			kind: "command",
			section: "Panels",
			title: "Toggle left panel",
			subtitle: "Collapse or reopen the explorer side panel",
			keywords: ["sidebar", "explorer"],
			icon: "toggleLeftPanel",
			run: shell.toggleLeftCollapsed,
		},
		{
			id: "command:toggle-right-panel",
			mode: "command",
			kind: "command",
			section: "Panels",
			title: "Toggle right panel",
			subtitle: "Collapse or reopen the inspector panel",
			keywords: ["inspector", "details"],
			icon: "toggleRightPanel",
			run: shell.toggleRightCollapsed,
		},
		{
			id: "command:right-card",
			mode: "command",
			kind: "command",
			section: "Panels",
			title: "Show card panel",
			subtitle: "Switch the right panel to card editing",
			keywords: ["inspector", "card"],
			icon: "rightCard",
			run: () => {
				setRightView("card");
			},
		},
		{
			id: "command:right-track",
			mode: "command",
			kind: "command",
			section: "Panels",
			title: "Show track panel",
			subtitle: "Switch the right panel to track editing",
			keywords: ["track panel"],
			icon: "rightTrack",
			run: () => {
				setRightView("track");
			},
		},
		{
			id: "command:right-activity",
			mode: "command",
			kind: "command",
			section: "Panels",
			title: "Show activity panel",
			subtitle: "Switch the right panel to activity",
			keywords: ["activity", "timeline"],
			icon: "rightActivity",
			run: () => {
				setRightView("activity");
			},
		},
		{
			id: "command:right-context",
			mode: "command",
			kind: "command",
			section: "Panels",
			title: "Show context panel",
			subtitle: "Switch the right panel to context",
			keywords: ["context"],
			icon: "rightContext",
			run: () => {
				setRightView("context");
			},
		},
		{
			id: "command:minimize-window",
			mode: "command",
			kind: "command",
			section: "Window",
			title: "Minimize window",
			subtitle: "Send Trackboi to the taskbar or dock",
			keywords: ["window", "minimize"],
			icon: "minimizeWindow",
			run: minimizeWindow,
		},
		{
			id: "command:maximize-window",
			mode: "command",
			kind: "command",
			section: "Window",
			title: "Toggle maximize window",
			subtitle: "Maximize or restore the desktop window",
			keywords: ["window", "maximize", "restore"],
			icon: "maximizeWindow",
			run: () => handleTitlebarDoubleClick(new MouseEvent("dblclick")),
		},
		{
			id: "command:close-window",
			mode: "command",
			kind: "command",
			section: "Window",
			title: "Close window",
			subtitle: "Close the current desktop window",
			keywords: ["window", "quit", "close"],
			icon: "closeWindow",
			run: closeWindow,
		},
	);

	if (snapshot.value) {
		items.push(
			{
				id: "command:project-settings",
				mode: "command",
				kind: "command",
				section: "Workspace",
				title: "Open project settings",
				subtitle: "Manage people aliases and project-scoped configuration",
				keywords: ["people", "aliases", "project"],
				icon: "projectSettings",
				run: openProjectSettings,
			},
			{
				id: "command:board-settings",
				mode: "command",
				kind: "command",
				section: "Workspace",
				title: "Open board settings",
				subtitle: "Manage boards and board-scoped fields",
				keywords: ["fields", "board"],
				icon: "boardSettings",
				run: openBoardSettings,
			},
		);
	}

	return items;
});

const commandCenter = useCommandCenter({
	navigateShortcut: commandCenterNavigateShortcut,
	commandShortcut: commandCenterCommandShortcut,
	items: commandCenterItems,
});

usePanelShortcuts({
	leftShortcut: leftPanelShortcut,
	rightShortcut: rightPanelShortcut,
	toggleLeftPanel: shell.toggleLeftCollapsed,
	toggleRightPanel: shell.toggleRightCollapsed,
});

useThemeMode(themeMode);

watch(columnPanelMode, (mode) => {
	if (mode === "closed" && shell.rightView.value === "column") {
		shell.setRightView("card");
	}
});

async function switchProjectFromRail(projectPath: string) {
	shell.setLeftView("explorer");
	await switchProject(projectPath);
}

async function createColumnFromBoard() {
	openCreateColumnPanel(snapshot.value?.board.columns.at(-1)?.id ?? null);
}

function editColumnFromBoard(column: { id: string }) {
	openColumnPanel(column.id);
}

async function submitColumnFromPanel() {
	await submitColumn();
	ensureRightPanelOpen();
	shell.setRightView("column");
}

async function deleteColumnFromPanel() {
	await deleteSelectedColumn();
	if (columnPanelMode.value === "closed" && shell.rightView.value === "column") {
		closeColumnPanel();
		shell.setRightView("card");
	}
}

async function moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
	const rollback = optimisticMoveCard(cardId, toColumn, beforeCardId);
	try {
		await run(async () => {
			upsertCard(await desktop.moveCard(cardId, toColumn, beforeCardId));
		}, { globalBusy: false, rethrow: true });
	} catch (errorValue) {
		rollback();
		throw errorValue;
	}
}

async function openSelectedCardInEditor(card: { id: string }) {
	await run(async () => {
		await desktop.openCardInEditor(card.id);
	});
}

async function saveEditorSettings() {
	await updateEditorPreference(appSettings.value.editor.preferredEditorId, appSettings.value.editor.customCommand);
}

async function handleRegisterAgent() {
	const name = agentNameDraft.value.trim();
	if (!name) return;
	await registerAgent({
		name,
		description: agentDescriptionDraft.value,
	});
	agentNameDraft.value = "";
	agentDescriptionDraft.value = "";
}

function handleGlobalDeleteKey(event: KeyboardEvent) {
	if (event.key !== "Delete" || !selectedCard.value) return;
	const target = event.target as HTMLElement | null;
	if (target?.closest("input, textarea, [contenteditable='true'], [contenteditable='']")) return;
	event.preventDefault();
	void deleteCard(selectedCard.value);
}

onMounted(() => {
	void loadProject();
	window.addEventListener("keydown", handleGlobalDeleteKey);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", handleGlobalDeleteKey);
});
</script>

<template>
	<div class="grid h-screen grid-rows-[36px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
		<div
			v-for="edge in resizeEdges"
			:key="edge"
			:class="resizeHandleClass(edge)"
			class="pointer-events-none"
			:style="{ cursor: resizeCursor(edge) }"
			@pointerdown="startWindowResize(edge, $event)"
		/>

		<WorkspaceTitleBar
			:project-name="activeProject?.name ?? snapshot?.project.name ?? 'Trackboi'"
			:branch-label="gitBranchLabel"
			@drag="startTitlebarDrag"
			@toggle-maximize="handleTitlebarDoubleClick"
			@minimize="minimizeWindow"
			@close="closeWindow"
		/>

		<main class="relative grid min-h-0 overflow-hidden" :style="shellGridStyle">
			<LeftRail
				:active-project-path="view.activeProjectPath"
				:projects="allEntries"
				@switch-project="switchProjectFromRail"
				@add-project="chooseProject"
				@settings="openSettings"
			/>

			<div class="min-h-0 overflow-hidden border-r border-border/70">
				<LeftWorkspacePanel
					v-if="!shell.leftCollapsed.value"
					:busy="busy"
					:selected-track-id="selectedTrackId"
					:selected-track="selectedTrack"
					:snapshot="snapshot"
					:track-counts="trackCounts"
					:tracks="tracks"
					:selected-worktree-id="selectedWorktreeId"
					:worktrees="worktrees"
					@select-worktree="selectWorktree"
					@select-track="handleTrackSelection"
					@create-track="createTrackFromShell"
					@open-project-settings="openProjectSettings"
				/>
			</div>

			<BoardWorkspace
				:active-project="activeProject"
				:busy="busy"
				:cards-by-column="cardsByColumn"
				:child-progress="childProgress"
				:custom-fields="customFields"
				:error="error"
				:fresh-card-ids="freshCardIds"
				:has-projects="hasProjects"
				:loading="loading"
				:boards="boards"
				:scope-empty-message="scopeEmptyMessage"
				:selected-board-id="selectedBoardId"
				:selected-card-id="selectedCard?.id ?? null"
				:selected-track="selectedTrack"
				:selected-worktree="selectedWorktree"
				:snapshot="snapshot"
				:track-labels="trackLabels"
				:visible-card-count="visibleCardCount"
				@choose-project="chooseProject"
				@select-board="selectBoard"
				@open-board-settings="openBoardSettings"
				@create-column="createColumnFromBoard"
				@edit-column="editColumnFromBoard"
				@create-card="openCardPanel"
				@clear-card-selection="closeCardPanel"
				@select-card="selectCardFromBoard"
				@edit-card="editCard"
				@delete-card="deleteCard"
				@open-card-in-editor="openSelectedCardInEditor"
				@fresh-seen="clearFreshCard"
				@move-card="moveCard"
			/>

			<RightWorkspacePanel
				v-model:draft="draft"
				v-model:track-id="trackId"
				v-model:field-values="fieldValues"
				v-model:comment-body="commentBody"
				v-model:subtask-title="subtaskTitle"
				v-model:column-name="columnNameDraft"
				v-model:column-insert-after="columnInsertAfterId"
				:active-view="shell.rightView.value"
				:busy="busy"
				:collapsed="shell.rightCollapsed.value"
				:card="selectedCard"
				:card-mode="cardPanelMode"
				:card-track="selectedCardTrack"
				:column="selectedColumn"
				:column-mode="columnPanelMode"
				:column-card-count="selectedColumnCardCount"
				:column-insert-after-options="columnInsertAfterOptions"
				:column-options="columnOptions"
				:comment-list="selectedCard?.comments ?? []"
				:current-branch="currentBranch"
				:custom-fields="customFields"
				:actor-labels="actorLabels"
				:subtask-progress="editingSubtaskProgress"
				:subtasks="editingSubtasks"
				:track="selectedTrack"
				:track-mode="trackPanelMode"
				:track-options="cardTrackOptions"
				:track-file-name="selectedTrackFileName"
				:track-file-content="selectedTrackFileContent"
				:linked-track-cards="linkedTrackCards"
				@select-view="setRightView"
				@submit-card="submitCard"
				@delete-card="deleteCard"
				@add-card-comment="addComment"
				@create-subtask="createSubtask"
				@edit-subtask="editCard"
				@save-track="saveTrack"
				@delete-track="deleteSelectedTrack"
				@load-track-file="loadSelectedTrackFile"
				@write-track-file="writeSelectedTrackFile"
				@delete-track-file="deleteSelectedTrackFile"
				@edit-track-card="editCard"
				@submit-column="submitColumnFromPanel"
				@delete-column="deleteColumnFromPanel"
			/>

			<PanelResizer
				side="left"
				class="absolute inset-y-0 z-20"
				:style="leftResizerStyle"
				:active-class="shell.leftResizeClass.value"
				@resize="shell.startResize"
				@reset="shell.resetLeftWidth"
			/>

			<PanelResizer
				side="right"
				class="absolute inset-y-0 z-20"
				:style="rightResizerStyle"
				:active-class="shell.rightResizeClass.value"
				@resize="shell.startResize"
				@reset="shell.resetRightWidth"
			/>

			<SettingsModal
				v-model:draft="storagePathDraft"
				v-model:left-panel-shortcut="leftPanelShortcut"
				v-model:right-panel-shortcut="rightPanelShortcut"
				v-model:command-center-navigate-shortcut="commandCenterNavigateShortcut"
				v-model:command-center-command-shortcut="commandCenterCommandShortcut"
				v-model:theme-mode="themeMode"
				v-model:preferred-editor-id="appSettings.editor.preferredEditorId"
				v-model:custom-editor-command="appSettings.editor.customCommand"
				v-model:agent-name-draft="agentNameDraft"
				v-model:agent-description-draft="agentDescriptionDraft"
				:open="settingsOpen"
				:paths="view.storageSearchPaths"
				:agents="appSettings.agents"
				:detected-editors="detectedEditors"
				:busy="busy"
				@close="closeSettings"
				@add="addStorageSearchPath"
				@remove="removeStorageSearchPath"
				@reset="resetStorageSearchPaths"
				@reset-shortcuts="resetPanelShortcuts"
				@reset-theme="resetThemeMode"
				@register-agent="handleRegisterAgent"
				@remove-agent="removeAgent"
				@save-editor="saveEditorSettings"
			/>

			<CommandCenter
				:open="commandCenter.open.value"
				:mode="commandCenter.activeMode.value"
				:query="commandCenter.query.value"
				:items="commandCenter.filteredItems.value"
				:selected-index="commandCenter.selectedIndex.value"
				@close="commandCenter.close"
				@update-query="commandCenter.setQuery"
				@move-selection="commandCenter.moveSelection"
				@select-active="commandCenter.selectActive"
				@select-index="commandCenter.selectIndex"
			/>

			<ProjectSettingsModal
				v-model:person-display-name-draft="personDisplayNameDraft"
				v-model:person-emails-draft="personEmailsDraft"
				v-model:person-names-draft="personNamesDraft"
				:open="projectSettingsOpen"
				:busy="busy"
				:snapshot="snapshot"
				:people="people"
				@close="closeProjectSettings"
				@add-person-alias="addPersonAlias"
				@remove-person-alias="removePersonAlias"
			/>

			<BoardSettingsModal
				v-model:board-create-name-draft="boardCreateNameDraft"
				v-model:board-name-draft="boardNameDraft"
				v-model:field-name-draft="fieldNameDraft"
				v-model:field-type-draft="fieldTypeDraft"
				v-model:field-options-draft="fieldOptionsDraft"
				:open="boardSettingsOpen"
				:busy="busy"
				:snapshot="snapshot"
				:boards="boards"
				:custom-fields="customFields"
				:field-type-options="fieldTypeOptions"
				@close="closeBoardSettings"
				@select-board="selectBoard"
				@create-board="createBoard"
				@delete-board="deleteBoard"
				@save-board-name="saveBoardName"
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
