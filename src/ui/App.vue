<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BoardView from "@/ui/components/BoardView.vue";
import EditCardModal from "@/ui/components/EditCardModal.vue";
import NewCardModal from "@/ui/components/NewCardModal.vue";
import ProjectSidebar from "@/ui/components/ProjectSidebar.vue";
import ProjectSettingsModal from "@/ui/components/ProjectSettingsModal.vue";
import SettingsModal from "@/ui/components/SettingsModal.vue";
import TrackInspector from "@/ui/components/TrackInspector.vue";
import TitleBar from "@/ui/components/TitleBar.vue";
import { useBoardPresentationState } from "@/ui/composables/useBoardPresentationState";
import { useCardWorkflow } from "@/ui/composables/useCardWorkflow";
import { useConfirmation } from "@/ui/composables/useConfirmation";
import { useDesktopProjectState } from "@/ui/composables/useDesktopProjectState";
import { useProjectBoardSettings } from "@/ui/composables/useProjectBoardSettings";
import { useTrackWorkflow } from "@/ui/composables/useTrackWorkflow";
import { useWindowChrome } from "@/ui/composables/useWindowChrome";
import { desktop } from "@/electron/renderer";
import ConfirmDialog from "@/ui/components/ConfirmDialog.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { BoardScopeMode } from "@/ui/viewTypes";

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
	projectSettingsOpen,
	storagePathDraft,
	run,
	setError,
	loadProject,
	refreshDesktopState,
	chooseProject,
	locateProject,
	removeProject,
	addStorageSearchPath,
	removeStorageSearchPath,
	resetStorageSearchPaths,
	openWorkspaceFile,
	closeWorkspaceFile,
	switchProject,
	selectWorktree,
	closeSettings,
	closeProjectSettings,
	activeWorkspaceFile,
	activeProject,
	canRemoveActiveProject,
	hasProjects,
	selectedWorktree,
	gitBranchLabel,
	currentBranch,
} = useDesktopProjectState(requestConfirmation);
const {
	selectedTrackId,
	trackInspectorOpen,
	trackInspectorMode,
	selectedTrackFileName,
	selectedTrackFileContent,
	selectedTrack,
	linkedTrackCards,
	trackLabels,
	cardTrackOptions,
	trackFilterOptions,
	closeTrackInspector,
	selectTrackFilter,
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
	draftTitle,
	draftDescription,
	draftColumn,
	draftTargetWorktreeId,
	draftTrackId,
	newCardOpen,
	editingCard,
	editCommentAuthor,
	editCommentBody,
	editFieldValues,
	editDraft,
	subtaskTitle,
	editTargetWorktreeId,
	editTrackId,
	openNewCard,
	closeNewCard,
	closeEditingCard,
	createNewCard,
	startEditing,
	saveEditingCard,
	addCommentToEditingCard,
	deleteExistingCard,
	createSubtask,
} = useCardWorkflow({
	snapshot,
	selectedWorktreeId,
	selectedTrackId,
	run,
	requestConfirmation,
});
const {
	boardScopeOptions,
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
	editingCardId: computed(() => editingCard.value?.id ?? null),
});
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

const columnOptions = computed<SelectOption[]>(() => (
	snapshot.value?.board.columns.map((column) => ({
		value: column.id,
		label: column.name,
	})) ?? []
));
const worktreeOptions = computed<SelectOption[]>(() => (
	[
		{ value: "__all__", label: "All worktrees" },
		...worktrees.value.map((worktree) => ({
			value: worktree.id,
			label: worktree.branch ? `${worktree.name} (${worktree.branch})` : worktree.name,
		})),
	]
));
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

			<div class="grid min-h-0 min-w-0" :class="trackInspectorOpen ? 'grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-[minmax(0,1fr)]'">
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
					:scope-empty-message="scopeEmptyMessage"
					:selected-worktree-id="selectedWorktreeId"
					:snapshot="snapshot"
					:track-filter-options="trackFilterOptions"
					:track-filter-value="selectedTrackId ?? '__all__'"
					:track-labels="trackLabels"
					:visible-card-count="visibleCardCount"
					:worktree-filter-id="worktreeFilterId"
					:worktrees="worktrees"
					:worktree-options="worktreeOptions"
					@choose-project="chooseProject"
					@close-workspace="closeWorkspaceFile"
					@create-card="openNewCard"
					@create-track="openCreateTrack"
					@delete-card="deleteExistingCard"
					@edit-card="startEditing"
					@locate-project="locateProject"
					@move-card="moveCard"
					@open-workspace="openWorkspaceFile"
					@open-new-card="openNewCard()"
					@project-settings="projectSettingsOpen = true"
					@remove-project="removeProject"
					@select-track="selectTrackFilter"
					@select-worktree="selectWorktree"
				/>

				<TrackInspector
					:open="trackInspectorOpen"
					:busy="busy"
					:mode="trackInspectorMode"
					:track="trackInspectorMode === 'edit' ? selectedTrack : null"
					:current-branch="currentBranch"
					:linked-cards="linkedTrackCards"
					:selected-file-name="selectedTrackFileName"
					:selected-file-content="selectedTrackFileContent"
					@close="closeTrackInspector"
					@save="saveTrack"
					@delete="deleteSelectedTrack"
					@load-file="loadSelectedTrackFile"
					@write-file="writeSelectedTrackFile"
					@delete-file="deleteSelectedTrackFile"
					@edit-card="startEditing"
				/>
			</div>

			<NewCardModal
				v-model:title="draftTitle"
				v-model:description="draftDescription"
				v-model:column="draftColumn"
				v-model:track-id="draftTrackId"
				v-model:target-worktree-id="draftTargetWorktreeId"
				:open="newCardOpen"
				:busy="busy"
				:column-options="columnOptions"
				:track-options="cardTrackOptions"
				:target-worktree-options="worktreeOptions"
				@close="closeNewCard"
				@create="createNewCard"
			/>

			<EditCardModal
				v-model:draft="editDraft"
				v-model:track-id="editTrackId"
				v-model:field-values="editFieldValues"
				v-model:subtask-title="subtaskTitle"
				v-model:comment-author="editCommentAuthor"
				v-model:comment-body="editCommentBody"
				v-model:target-worktree-id="editTargetWorktreeId"
				:card="editingCard"
				:busy="busy"
				:column-options="columnOptions"
				:track-options="cardTrackOptions"
				:custom-fields="customFields"
				:comments="editingCard?.comments ?? []"
				:subtasks="editingSubtasks"
				:subtask-progress="editingSubtaskProgress"
				:target-worktree-locked="true"
				:target-worktree-options="worktreeOptions"
				@close="closeEditingCard"
				@save="saveEditingCard"
				@delete="deleteExistingCard"
				@edit-subtask="startEditing"
				@add-comment="addCommentToEditingCard"
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
