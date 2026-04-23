<script setup lang="ts">
import Sortable, { type SortableEvent } from "sortablejs";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Plus } from "lucide-vue-next";
import type { Card as TrackboiCard, Column, CustomField, ProjectEntry, ProjectSnapshot, Track, WorktreeContext } from "@/core/types";
import BoardColumn from "@/ui/components/BoardColumn.vue";
import Button from "@/ui/components/Button.vue";
import UiCard from "@/ui/components/Card.vue";
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
	visibleCardCount: number;
}>();

const emit = defineEmits<{
	chooseProject: [];
	createCard: [columnId?: string];
	createColumn: [];
	editColumn: [column: Column];
	reorderColumn: [columnId: string, beforeColumnId: string | null];
	clearCardSelection: [];
	selectCard: [card: TrackboiCard];
	editCard: [card: TrackboiCard];
	deleteCard: [card: TrackboiCard];
	openCardInEditor: [card: TrackboiCard];
	freshSeen: [cardId: string];
	moveCard: [cardId: string, toColumn: string, beforeCardId: string | null];
}>();

const columnsElement = ref<HTMLElement | null>(null);
let columnSortable: Sortable | null = null;

const boardSubtitle = computed(() => {
	if (props.selectedTrack) {
		return `${props.selectedWorktree?.name ?? "Current worktree"} · ${props.selectedTrack.title} · ${props.visibleCardCount} visible cards`;
	}
	if (props.selectedWorktree) {
		return `${props.selectedWorktree.name} · current worktree context · ${props.visibleCardCount} visible cards`;
	}
	return `Current workspace context · ${props.visibleCardCount} visible cards`;
});

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
	() => props.snapshot?.board.columns.map((column) => column.id).join("|") ?? "",
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
	<main class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
		<header class="border-b border-border/65 px-5 py-4">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Board</div>
					<h1 class="truncate text-[22px] font-semibold tracking-tight text-foreground">
						{{ activeProject?.name ?? snapshot?.project.name ?? "Trackboi" }} / {{ snapshot?.board.name ?? "Delivery" }}
					</h1>
					<p class="mt-2 truncate trackboi-mono-font text-[11px] text-muted-foreground">
						{{ boardSubtitle }}
					</p>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<Button
						v-if="snapshot"
						type="button"
						size="icon"
						title="New card"
						aria-label="New card"
						:disabled="busy"
						data-testid="board-new-card"
						@click="emit('createCard')"
					>
						<Plus class="h-4 w-4" />
					</Button>
				</div>
			</div>
		</header>

		<div class="grid h-full min-h-0 overflow-hidden py-4">
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
						Trackboi will create a `.trackboi` folder with a starter board.
					</p>
				</div>
				<div class="flex gap-2">
					<Button class="w-fit" type="button" :disabled="busy" @click="emit('chooseProject')">
						Choose project
					</Button>
				</div>
			</UiCard>

			<div v-else class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4">
				<div class="app-scroll min-h-0 overflow-x-auto overflow-y-hidden" @pointerdown="clearCardSelectionFromBackground">
					<div ref="columnsElement" class="grid h-full min-w-max grid-flow-col auto-cols-[356px] items-stretch gap-4 px-5">
						<BoardColumn
							v-for="column in snapshot.board.columns"
							:key="column.id"
							:column="column"
							:columns="snapshot.board.columns"
							:cards="cardsByColumn[column.id] ?? []"
							:child-progress="childProgress"
							:custom-fields="customFields"
							:fresh-card-ids="freshCardIds"
							:selected-card-id="selectedCardId ?? null"
							:track-labels="trackLabels"
							@move="forwardMove"
							@create="emit('createCard', $event)"
							@edit-column="emit('editColumn', $event)"
							@select="emit('selectCard', $event)"
							@edit="emit('editCard', $event)"
							@delete="emit('deleteCard', $event)"
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
		</div>
	</main>
</template>
