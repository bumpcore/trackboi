<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BoardWorkspace from "@/ui/components/BoardWorkspace.vue";
import ConfirmDialog from "@/ui/components/ConfirmDialog.vue";
import LeftRail from "@/ui/components/LeftRail.vue";
import LeftWorkspacePanel from "@/ui/components/LeftWorkspacePanel.vue";
import PanelResizer from "@/ui/components/PanelResizer.vue";
import RightWorkspacePanel from "@/ui/components/RightWorkspacePanel.vue";
import SettingsModal from "@/ui/components/SettingsModal.vue";
import WorkspaceTitleBar from "@/ui/components/WorkspaceTitleBar.vue";
import { desktop } from "@/electron/renderer";
import { useBoardPresentationState } from "@/ui/composables/useBoardPresentationState";
import { useCardWorkflow } from "@/ui/composables/useCardWorkflow";
import { useConfirmation } from "@/ui/composables/useConfirmation";
import { useDesktopProjectState } from "@/ui/composables/useDesktopProjectState";
import { useFreshCardHighlights } from "@/ui/composables/useFreshCardHighlights";
import { useProjectBoardSettings } from "@/ui/composables/useProjectBoardSettings";
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
	worktreeFilterId,
	loading,
	busy,
	error,
	settingsOpen,
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
	targetWorktreeId,
	fieldValues,
	commentAuthor,
	commentBody,
	subtaskTitle,
	openCreateCard,
	openCard,
	submitCard,
	addComment,
	deleteCard,
	createSubtask,
} = useCardWorkflow({
	snapshot,
	selectedWorktreeId,
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
	worktreeFilterId,
	editingCardId: computed(() => selectedCard.value?.id ?? null),
});

const { freshCardIds, clearFreshCard } = useFreshCardHighlights(snapshot);

const {
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
} = useProjectBoardSettings({
	snapshot,
	columnCardCounts: allColumnCardCounts,
	run,
	setError,
	requestConfirmation,
});

const shell = useWorkspaceShellState();
const rightViewPinned = ref(false);

const columnOptions = computed<SelectOption[]>(() => (
	snapshot.value?.board.columns.map((column) => ({
		value: column.id,
		label: column.name,
	})) ?? []
));

const cardTargetWorktreeOptions = computed<SelectOption[]>(() => (
	worktrees.value.map((worktree) => ({
		value: worktree.id,
		label: worktree.branch ? `${worktree.name} (${worktree.branch})` : worktree.name,
	}))
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

const shellGridStyle = computed(() => ({
	gridTemplateColumns: `56px ${shell.leftPanelWidth.value}px 4px minmax(0,1fr) 4px ${shell.rightPanelWidth.value}px`,
}));

function setRightView(view: RightPanelView) {
	if (shell.rightCollapsed.value) shell.rightCollapsed.value = false;
	shell.setRightView(view);
	rightViewPinned.value = view === "activity" || view === "context" || view === "project-settings";
}

function ensureRightPanelOpen() {
	if (shell.rightCollapsed.value) shell.rightCollapsed.value = false;
}

function openCardPanel(columnId?: string) {
	openCreateCard(columnId);
	ensureRightPanelOpen();
	rightViewPinned.value = false;
	shell.setRightView("card");
}

function editCard(card: Parameters<typeof openCard>[0]) {
	openCard(card);
	ensureRightPanelOpen();
	if (!rightViewPinned.value || shell.rightView.value === "project-settings") {
		shell.setRightView("card");
	}
}

function openTrackPanel(trackId: string) {
	selectTrack(trackId);
	ensureRightPanelOpen();
	if (!rightViewPinned.value || shell.rightView.value === "project-settings") {
		shell.setRightView("track");
	}
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
	rightViewPinned.value = false;
	shell.setRightView("track");
}

async function switchProjectFromRail(projectId: string) {
	shell.setLeftView("explorer");
	await switchProject(projectId);
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

desktop.addBoardChangedListener(() => {
	void refreshDesktopState();
});

onMounted(loadProject);
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

		<main class="grid min-h-0 overflow-hidden" :style="shellGridStyle">
			<LeftRail
				:active-view="shell.leftView.value"
				:active-project-id="view.activeProjectId"
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
					:worktree-filter-id="worktreeFilterId"
					:worktrees="worktrees"
					@select-worktree="selectWorktree"
					@select-track="handleTrackSelection"
					@create-track="createTrackFromShell"
					@toggle-collapsed="shell.toggleLeftCollapsed"
				/>
			</div>

			<PanelResizer
				side="left"
				:active-class="shell.leftResizeClass.value"
				@resize="shell.startResize"
				@reset="shell.resetLeftWidth"
			/>

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
				:scope-empty-message="scopeEmptyMessage"
				:selected-card-id="selectedCard?.id ?? null"
				:selected-track="selectedTrack"
				:selected-worktree="selectedWorktree"
				:snapshot="snapshot"
				:track-labels="trackLabels"
				:visible-card-count="visibleCardCount"
				@choose-project="chooseProject"
				@create-column="createColumnFromBoard"
				@create-card="openCardPanel"
				@edit-card="editCard"
				@delete-card="deleteCard"
				@fresh-seen="clearFreshCard"
				@move-card="moveCard"
			/>

			<PanelResizer
				side="right"
				:active-class="shell.rightResizeClass.value"
				@resize="shell.startResize"
				@reset="shell.resetRightWidth"
			/>

			<RightWorkspacePanel
				v-model:draft="draft"
				v-model:track-id="trackId"
				v-model:target-worktree-id="targetWorktreeId"
				v-model:field-values="fieldValues"
				v-model:comment-author="commentAuthor"
				v-model:comment-body="commentBody"
				v-model:subtask-title="subtaskTitle"
				v-model:board-name-draft="boardNameDraft"
				v-model:column-name-drafts="columnNameDrafts"
				v-model:new-column-name="newColumnName"
				v-model:field-name-draft="fieldNameDraft"
				v-model:field-type-draft="fieldTypeDraft"
				v-model:field-options-draft="fieldOptionsDraft"
				:active-view="shell.rightView.value"
				:busy="busy"
				:collapsed="shell.rightCollapsed.value"
				:card="selectedCard"
				:card-mode="cardPanelMode"
				:card-track="selectedCardTrack"
				:column-options="columnOptions"
				:column-card-counts="allColumnCardCounts"
				:comment-list="selectedCard?.comments ?? []"
				:current-branch="currentBranch"
				:custom-fields="customFields"
				:field-type-options="fieldTypeOptions"
				:project-snapshot="snapshot"
				:subtask-progress="editingSubtaskProgress"
				:subtasks="editingSubtasks"
				:target-worktree-options="cardTargetWorktreeOptions"
				:track="selectedTrack"
				:track-mode="trackPanelMode"
				:track-options="cardTrackOptions"
				:track-file-name="selectedTrackFileName"
				:track-file-content="selectedTrackFileContent"
				:linked-track-cards="linkedTrackCards"
				@select-view="setRightView"
				@toggle-collapsed="shell.toggleRightCollapsed"
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
				@save-board-name="saveBoardName"
				@rename-column="renameColumn"
				@remove-column="removeColumn"
				@add-column="addColumn"
				@add-custom-field="addCustomField"
				@remove-custom-field="removeCustomField"
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
