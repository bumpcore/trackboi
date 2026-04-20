<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BoardSettingsModal from "@/ui/components/BoardSettingsModal.vue";
import BoardWorkspace from "@/ui/components/BoardWorkspace.vue";
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
import type { BoardScopeMode, RightPanelView } from "@/ui/viewTypes";

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
	refreshDesktopState,
	chooseProject,
	addStorageSearchPath,
	removeStorageSearchPath,
	resetStorageSearchPaths,
	switchProject,
	selectWorktree,
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
} = useCardWorkflow({
	snapshot,
	selectedTrackId,
	run,
	requestConfirmation,
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
	columnNameDrafts,
	newColumnName,
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
	addColumn,
	renameColumn,
	removeColumn,
	addCustomField,
	removeCustomField,
	addPersonAlias,
	removePersonAlias,
} = useProjectBoardSettings({
	snapshot,
	columnCardCounts: allColumnCardCounts,
	run,
	setError,
	requestConfirmation,
	refreshDesktopState,
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
	selectTrack(trackId);
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

function openBoardSettings() {
	boardSettingsOpen.value = true;
}

function closeBoardSettings() {
	boardSettingsOpen.value = false;
}

usePanelShortcuts({
	leftShortcut: leftPanelShortcut,
	rightShortcut: rightPanelShortcut,
	toggleLeftPanel: shell.toggleLeftCollapsed,
	toggleRightPanel: shell.toggleRightCollapsed,
});

useThemeMode(themeMode);

async function switchProjectFromRail(projectPath: string) {
	shell.setLeftView("explorer");
	await switchProject(projectPath);
}

async function createColumnFromBoard() {
	const existingCount = snapshot.value?.board.columns.length ?? 0;
	await addColumn(`New Column ${existingCount + 1}`);
}

async function moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
	await run(async () => {
		await desktop.moveCard(cardId, toColumn, beforeCardId);
	});
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

desktop.addBoardChangedListener(() => {
	void refreshDesktopState();
});

onMounted(() => {
	void loadProject();
	window.addEventListener("keydown", handleGlobalDeleteKey);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", handleGlobalDeleteKey);
});
</script>

<template>
	<div class="grid h-screen grid-rows-[44px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
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
			:location-label="snapshot?.project.path ?? activeProject?.path ?? null"
			@drag="startTitlebarDrag"
			@toggle-maximize="handleTitlebarDoubleClick"
			@minimize="minimizeWindow"
			@close="closeWindow"
		/>

		<main class="relative grid min-h-0 overflow-hidden" :style="shellGridStyle">
			<LeftRail
				:active-view="shell.leftView.value"
				:active-project-path="view.activeProjectPath"
				:projects="allEntries"
				@select="shell.setLeftView"
				@switch-project="switchProjectFromRail"
				@add-project="chooseProject"
				@settings="settingsOpen = true"
			/>

			<div class="min-h-0 overflow-hidden border-r border-border/70">
				<LeftWorkspacePanel
					v-if="!shell.leftCollapsed.value"
					:active-view="shell.leftView.value"
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
				@create-card="openCardPanel"
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
				:active-view="shell.rightView.value"
				:busy="busy"
				:collapsed="shell.rightCollapsed.value"
				:card="selectedCard"
				:card-mode="cardPanelMode"
				:card-track="selectedCardTrack"
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
				v-model:column-name-drafts="columnNameDrafts"
				v-model:new-column-name="newColumnName"
				v-model:field-name-draft="fieldNameDraft"
				v-model:field-type-draft="fieldTypeDraft"
				v-model:field-options-draft="fieldOptionsDraft"
				:open="boardSettingsOpen"
				:busy="busy"
				:snapshot="snapshot"
				:boards="boards"
				:column-card-counts="allColumnCardCounts"
				:custom-fields="customFields"
				:field-type-options="fieldTypeOptions"
				@close="closeBoardSettings"
				@select-board="selectBoard"
				@create-board="createBoard"
				@delete-board="deleteBoard"
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
