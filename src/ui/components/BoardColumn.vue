<script setup lang="ts">
import Sortable, { type SortableEvent } from "sortablejs";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ChevronRight, CircleDashed, GripVertical, Plus, Trash2 } from "lucide-vue-next";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import MarkdownContent from "@/ui/components/MarkdownContent.vue";
import MarkdownInline from "@/ui/components/MarkdownInline.vue";
import UiCard from "@/ui/components/Card.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { Card as TrackboiCard, Column, CustomField, FieldValue } from "@/core/types";

const props = defineProps<{
	column: Column;
	columns: Column[];
	cards: TrackboiCard[];
	childProgress: Record<string, { total: number; done: number }>;
	customFields: CustomField[];
	freshCardIds?: Set<string>;
	selectedCardId?: string | null;
	trackLabels: Record<string, string>;
}>();

const emit = defineEmits<{
	move: [cardId: string, toColumn: string, beforeCardId: string | null];
	create: [columnId: string];
	editColumn: [column: Column];
	select: [card: TrackboiCard];
	edit: [card: TrackboiCard];
	delete: [card: TrackboiCard];
	openInEditor: [card: TrackboiCard];
	freshSeen: [cardId: string];
}>();

const listElement = ref<HTMLElement | null>(null);
const contextMenu = ref<{
	card: TrackboiCard;
	x: number;
	y: number;
	moveOpen: boolean;
	moveMenuSide: "left" | "right";
} | null>(null);
const CONTEXT_MENU_WIDTH = 208;
const CONTEXT_MENU_HEIGHT = 180;
const CONTEXT_MENU_MARGIN = 8;
const hasCards = computed(() => props.cards.length > 0);
const showDraggedSourceEmptyState = ref(false);
let sortableInstance: Sortable | null = null;
let suppressActivation = false;
let activationResetTimer: number | null = null;
let moveMenuCloseTimer: number | null = null;

const showEmptyState = computed(() => (
	!hasCards.value || showDraggedSourceEmptyState.value
));

function cleanupLaneArtifacts() {
	const list = listElement.value;
	if (!list) return;

	const validIds = new Set(props.cards.map((card) => card.id));
	const seenIds = new Set<string>();

	for (const element of Array.from(list.querySelectorAll<HTMLElement>("[data-card-id]"))) {
		const cardId = element.dataset.cardId;
		const isDirectChild = element.parentElement === list;

		if (!cardId || !isDirectChild || !validIds.has(cardId) || seenIds.has(cardId)) {
			element.remove();
			continue;
		}

		seenIds.add(cardId);
		element.classList.remove("sortable-chosen", "sortable-drag", "sortable-fallback", "card-dragging");
	}
}

function cleanupGlobalDragArtifacts() {
	for (const element of Array.from(document.body.querySelectorAll<HTMLElement>(".sortable-fallback, .card-fallback"))) {
		element.remove();
	}
}

function clearActiveDragTargets() {
	for (const column of Array.from(document.querySelectorAll<HTMLElement>(".column-shell[data-drag-target='true']"))) {
		delete column.dataset.dragTarget;
	}
}

function setActiveDragTarget(list: HTMLElement | null) {
	for (const column of Array.from(document.querySelectorAll<HTMLElement>(".column-shell[data-drag-target='true']"))) {
		delete column.dataset.dragTarget;
	}
	const column = list?.closest<HTMLElement>(".column-shell");
	if (!column) return;
	column.dataset.dragTarget = "true";
}

function clearActivationResetTimer() {
	if (activationResetTimer !== null) {
		window.clearTimeout(activationResetTimer);
		activationResetTimer = null;
	}
}

function beginDrag(sourceList?: HTMLElement | null) {
	suppressActivation = true;
	clearActiveDragTargets();
	showDraggedSourceEmptyState.value = sourceList === listElement.value && props.cards.length === 1;
	clearActivationResetTimer();
	closeContextMenu();
}

function endDrag() {
	clearActivationResetTimer();
	activationResetTimer = window.setTimeout(() => {
		suppressActivation = false;
		activationResetTimer = null;
	}, 120);
	showDraggedSourceEmptyState.value = false;
	clearActiveDragTargets();
	cleanupGlobalDragArtifacts();
}

function nextCardIdAfter(item: HTMLElement): string | null {
	let sibling = item.nextElementSibling as HTMLElement | null;
	while (sibling) {
		if (sibling.dataset.cardId) return sibling.dataset.cardId;
		sibling = sibling.nextElementSibling as HTMLElement | null;
	}
	return null;
}

function emitMoveFromItem(item: HTMLElement | null) {
	const cardId = item?.dataset.cardId;
	if (!cardId) return;
	const columnId = item.closest<HTMLElement>("[data-column-id]")?.dataset.columnId;
	if (!columnId) return;
	emit("move", cardId, columnId, nextCardIdAfter(item));
}

function cardElementsForList(list: HTMLElement, draggedCardId?: string) {
	const elements: HTMLElement[] = [];
	for (const child of Array.from(list.children)) {
		if (!(child instanceof HTMLElement)) continue;
		const cardId = child.dataset.cardId;
		if (!cardId || cardId === draggedCardId) continue;
		elements.push(child);
	}
	return elements;
}

function beforeCardIdAtPointer(list: HTMLElement, clientY: number, draggedCardId?: string): string | null {
	for (const element of cardElementsForList(list, draggedCardId)) {
		const cardId = element.dataset.cardId;
		if (!cardId) continue;
		const rect = element.getBoundingClientRect();
		if (clientY <= rect.top + (rect.height / 2)) {
			return cardId;
		}
	}
	return null;
}

function emitMoveFromDrop(event: SortableEvent) {
	const item = event.item as HTMLElement | null;
	const cardId = item?.dataset.cardId;
	if (!cardId) return;
	const previousIndex = event.oldDraggableIndex ?? event.oldIndex;
	const nextIndex = event.newDraggableIndex ?? event.newIndex;
	if (event.from === event.to && previousIndex != null && nextIndex != null && previousIndex === nextIndex) {
		return;
	}

	const targetList = event.to as HTMLElement | null;
	const columnId = targetList?.closest<HTMLElement>("[data-column-id]")?.dataset.columnId;
	if (!targetList || !columnId) {
		emitMoveFromItem(item);
		return;
	}

	const originalEvent = (event as SortableEvent & { originalEvent?: Event }).originalEvent;
	const beforeCardId = originalEvent instanceof MouseEvent
		? beforeCardIdAtPointer(targetList, originalEvent.clientY, cardId)
		: nextCardIdAfter(item);
	emit("move", cardId, columnId, beforeCardId);
}

function pointerWithinDropZone(list: HTMLElement, event: Event | undefined): boolean {
	if (props.cards.length === 0) return true;
	if (!(event instanceof MouseEvent)) return true;
	const rect = list.getBoundingClientRect();
	const horizontalPadding = 18;
	const verticalPadding = 8;
	return (
		event.clientX >= rect.left + horizontalPadding
		&& event.clientX <= rect.right - horizontalPadding
		&& event.clientY >= rect.top + verticalPadding
		&& event.clientY <= rect.bottom - verticalPadding
	);
}

function mountSortable() {
	if (!listElement.value) return;
	sortableInstance?.destroy();
	sortableInstance = Sortable.create(listElement.value, {
		group: "trackboi-cards",
		animation: 140,
		direction: "vertical",
		dataIdAttr: "data-card-id",
		draggable: "[data-card-id]",
		chosenClass: "card-chosen",
		fallbackTolerance: 4,
		fallbackClass: "card-fallback",
		ghostClass: "card-ghost",
		dragClass: "card-dragging",
		emptyInsertThreshold: 48,
		invertSwap: true,
		swapThreshold: 0.6,
		filter: "[data-sortable-ignore]",
		preventOnFilter: false,
		onStart(event) {
			beginDrag(event.from as HTMLElement | null);
		},
		onMove(event, originalEvent) {
			const targetList = event.to as HTMLElement | null;
			if (!targetList) return true;
			setActiveDragTarget(targetList);
			return pointerWithinDropZone(targetList, originalEvent);
		},
		onEnd(event) {
			emitMoveFromDrop(event);
			endDrag();
		},
	});
}

function fieldDisplayValue(field: CustomField, value: FieldValue | undefined) {
	if (value == null || value === "" || value === false) return null;
	if (field.type === "checkbox") return value === true ? "Yes" : null;
	return String(value);
}

function visibleFieldEntries(card: TrackboiCard) {
	return props.customFields.flatMap((field) => {
		const value = fieldDisplayValue(field, card.fieldValues[field.id]);
		return value ? [{ field, value }] : [];
	});
}

function activateCard(card: TrackboiCard) {
	if (suppressActivation) return;
	emit("select", card);
}

function openCardEditor(card: TrackboiCard) {
	if (suppressActivation) return;
	emit("edit", card);
}

function openContextMenu(card: TrackboiCard, event: MouseEvent) {
	event.preventDefault();
	event.stopPropagation();
	emit("select", card);
	const currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
	const rect = currentTarget?.getBoundingClientRect();
	const pointerX = Number.isFinite(event.clientX) && event.clientX > 0
		? event.clientX
		: (rect?.left ?? 0) + 20;
	const pointerY = Number.isFinite(event.clientY) && event.clientY > 0
		? event.clientY
		: (rect?.top ?? 0) + 20;
	const maxX = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN);
	const maxY = Math.max(CONTEXT_MENU_MARGIN, window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN);
	contextMenu.value = {
		card,
		x: Math.min(Math.max(pointerX, CONTEXT_MENU_MARGIN), maxX),
		y: Math.min(Math.max(pointerY, CONTEXT_MENU_MARGIN), maxY),
		moveOpen: false,
		moveMenuSide: pointerX > window.innerWidth - (CONTEXT_MENU_WIDTH * 2) ? "left" : "right",
	};
}

function closeContextMenu() {
	if (moveMenuCloseTimer !== null) {
		window.clearTimeout(moveMenuCloseTimer);
		moveMenuCloseTimer = null;
	}
	contextMenu.value = null;
}

function handlePointerDown() {
	closeContextMenu();
}

function moveViaContext(columnId: string) {
	if (!contextMenu.value) return;
	emit("move", contextMenu.value.card.id, columnId, null);
	closeContextMenu();
}

function availableMoveColumns() {
	const menu = contextMenu.value;
	if (!menu) return [];
	return props.columns.filter((candidate) => candidate.id !== menu.card.column);
}

function openMoveMenu() {
	if (!contextMenu.value) return;
	if (moveMenuCloseTimer !== null) {
		window.clearTimeout(moveMenuCloseTimer);
		moveMenuCloseTimer = null;
	}
	contextMenu.value.moveOpen = true;
}

function scheduleMoveMenuClose() {
	if (!contextMenu.value) return;
	if (moveMenuCloseTimer !== null) {
		window.clearTimeout(moveMenuCloseTimer);
	}
	moveMenuCloseTimer = window.setTimeout(() => {
		if (contextMenu.value) {
			contextMenu.value.moveOpen = false;
		}
		moveMenuCloseTimer = null;
	}, 180);
}

watch(contextMenu, (nextMenu, previousMenu) => {
	if (!previousMenu && nextMenu) {
		window.setTimeout(() => {
			if (contextMenu.value) window.addEventListener("pointerdown", handlePointerDown);
		}, 0);
		return;
	}
	if (previousMenu && !nextMenu) {
		window.removeEventListener("pointerdown", handlePointerDown);
	}
});

watch(listElement, () => {
	void nextTick(() => {
		mountSortable();
		cleanupLaneArtifacts();
	});
});

watch(
	() => props.cards.map((card) => card.id).join("|"),
	() => {
		void nextTick(() => {
			cleanupLaneArtifacts();
		});
	},
);

onMounted(() => {
	mountSortable();
});

onBeforeUnmount(() => {
	showDraggedSourceEmptyState.value = false;
	clearActiveDragTargets();
	window.removeEventListener("pointerdown", handlePointerDown);
	sortableInstance?.destroy();
	clearActivationResetTimer();
	cleanupGlobalDragArtifacts();
	if (moveMenuCloseTimer !== null) {
		window.clearTimeout(moveMenuCloseTimer);
	}
});
</script>

<template>
	<section
		class="column-shell grid h-full min-h-0 w-[356px] min-w-[356px] max-w-[356px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-border/70 bg-secondary/45 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)]"
		:data-column-id="column.id"
		:data-board-column-id="column.id"
		:data-testid="`column-${column.id}`"
	>
		<header class="flex items-start justify-between gap-3 border-b border-border/55 px-4 py-3">
			<div class="flex min-w-0 flex-1 items-start gap-1">
				<Tooltip content="Drag column" side="top">
					<button
						type="button"
						class="-ml-1 mt-0.5 grid h-6 w-5 shrink-0 cursor-grab place-items-center text-muted-foreground/55 transition-colors hover:text-foreground active:cursor-grabbing"
						data-column-drag-handle
						aria-label="Drag column"
					>
						<GripVertical class="h-4 w-4" />
					</button>
				</Tooltip>
				<button
					type="button"
					class="min-w-0 flex-1 text-left"
					@click="emit('editColumn', column)"
				>
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-primary/90" aria-hidden="true" />
					<h2 class="truncate text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground/94">{{ column.name }}</h2>
				</div>
				<p class="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{{ props.cards.length }} cards</p>
				</button>
			</div>
			<div class="flex items-center gap-2">
				<Tooltip content="Add card" side="left">
					<Button
						variant="ghost"
						size="icon"
						class="rounded-[2px] border border-transparent hover:border-border/60 hover:bg-background/70"
						type="button"
						data-sortable-ignore
						@click="emit('create', column.id)"
					>
						<Plus class="h-4 w-4" />
					</Button>
				</Tooltip>
			</div>
		</header>

		<div class="app-scroll column-card-list min-h-0 overflow-y-auto">
			<div class="relative h-full min-h-full">
				<div
					ref="listElement"
					class="flex h-full min-h-full flex-col gap-2.5 px-2.5 py-3"
					data-column-list="true"
					:data-testid="`column-${column.id}-list`"
				>
					<UiCard
						v-for="card in props.cards"
						:key="card.id"
						class="board-card group relative grid w-full min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 overflow-hidden p-3 transition"
						:data-card-id="card.id"
						:data-fresh="props.freshCardIds?.has(card.id) ?? false"
						:data-selected="props.selectedCardId === card.id"
						:data-testid="`card-${card.id}`"
						role="button"
						tabindex="0"
						@click="activateCard(card)"
						@dblclick.stop="openCardEditor(card)"
						@mousedown.right.capture.prevent.stop="openContextMenu(card, $event)"
						@contextmenu.capture.prevent.stop="openContextMenu(card, $event)"
						@mouseenter="emit('freshSeen', card.id)"
						@keydown.enter.prevent="openCardEditor(card)"
						@keydown.space.prevent="activateCard(card)"
					>
					<div
						class="min-w-0 max-w-full bg-transparent text-left"
					>
						<MarkdownInline
							:value="card.title"
							class="block [overflow-wrap:anywhere] text-[13px] font-semibold leading-5 text-foreground"
						/>
						<MarkdownContent
							v-if="card.description"
							:value="card.description"
							preview
							class="mt-1.5 text-[12px] leading-5 text-muted-foreground"
						/>
						<div class="mt-2 flex max-w-full flex-wrap gap-1.5">
							<Badge
								v-if="card.trackId && props.trackLabels[card.trackId]"
								class="max-w-full border-primary/28 bg-primary/10 text-primary/95"
								variant="outline"
							>
								<span class="truncate">{{ props.trackLabels[card.trackId] }}</span>
							</Badge>
						</div>
					<div class="mt-2 flex max-w-full flex-wrap gap-1.5">
						<Badge
							v-if="card.worktreeIds && card.worktreeIds.length > 0"
							class="max-w-full border-border/70 bg-background/36 text-muted-foreground"
							variant="outline"
						>
							<span class="truncate">
								{{ card.variants?.map((variant) => variant.worktreeName).join(", ") }}
							</span>
						</Badge>
						<Badge v-if="card.conflicted" class="border-destructive/30 bg-destructive/12 text-destructive" variant="secondary">
							Conflict
						</Badge>
						<Badge
							v-if="props.childProgress[card.id]"
							class="border-border/65 bg-secondary/88 text-secondary-foreground"
							variant="secondary"
						>
							{{ props.childProgress[card.id].done }}/{{ props.childProgress[card.id].total }} subtasks
						</Badge>
					</div>
					<div v-if="props.customFields.length > 0" class="mt-2 flex max-w-full flex-wrap gap-1.5">
						<Badge
							v-for="entry in visibleFieldEntries(card)"
							:key="entry.field.id"
							variant="outline"
							class="max-w-full gap-1 border-border/60 bg-background/24 text-foreground/92"
						>
							<span class="text-muted-foreground/90">{{ entry.field.name }}</span>
							<span class="truncate">{{ entry.value }}</span>
						</Badge>
					</div>
					</div>
					<Button
						class="mt-0.5 rounded-[2px] border border-transparent opacity-0 transition group-hover:border-border/55 group-hover:bg-background/72 group-hover:opacity-100"
						variant="ghost"
						size="icon"
						type="button"
						title="Delete card"
						aria-label="Delete card"
						data-sortable-ignore
						@click.stop="emit('delete', card)"
					>
						<Trash2 class="h-4 w-4" />
					</Button>
					</UiCard>
				</div>

				<div
					v-if="showEmptyState"
					class="pointer-events-none absolute inset-x-0 top-0 px-2.5 py-3"
					:data-testid="`column-${column.id}-empty`"
				>
					<div class="column-empty-state rounded-[2px] border border-dashed border-border/55 bg-background/16 px-6 py-5 text-center">
						<CircleDashed class="mx-auto h-4 w-4 text-muted-foreground" />
						<p class="mt-2 text-xs font-medium text-muted-foreground">Drop cards here</p>
						<Button class="pointer-events-auto mt-3" variant="ghost" size="sm" type="button" @click="emit('create', column.id)">
							Add card
						</Button>
					</div>
				</div>

				<Teleport to="body">
					<div
						v-if="contextMenu"
						class="fixed z-[80] min-w-36 rounded-[2px] border border-border/75 bg-card/98 p-1 shadow-[0_18px_34px_hsl(0_0%_0%/0.16)] backdrop-blur-sm"
						:style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
						data-testid="card-context-menu"
						data-sortable-ignore
						@pointerdown.stop
						@click.stop
					>
							<button
								type="button"
								class="trackboi-mono-font flex w-full items-center rounded-[2px] px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary/55"
								data-testid="card-context-edit"
								@click="openCardEditor(contextMenu.card); closeContextMenu()"
							>
								Edit
						</button>
							<button
								type="button"
								class="trackboi-mono-font flex w-full items-center rounded-[2px] px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary/55"
								data-testid="card-context-open-in-editor"
								@click="emit('openInEditor', contextMenu.card); closeContextMenu()"
							>
								Open in editor
						</button>
						<div
							class="relative"
							@mouseenter="openMoveMenu()"
							@mouseleave="scheduleMoveMenuClose()"
						>
							<button
								type="button"
								class="trackboi-mono-font flex w-full items-center justify-between rounded-[2px] px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary/55"
								data-testid="card-context-move"
								@click="contextMenu.moveOpen = !contextMenu.moveOpen"
							>
								<span>Move to</span>
								<ChevronRight class="h-3 w-3 text-muted-foreground" />
							</button>
							<div
								v-if="contextMenu.moveOpen"
								class="absolute top-0 z-[81] min-w-32 rounded-[2px] border border-border/75 bg-card/98 p-1 shadow-[0_18px_34px_hsl(0_0%_0%/0.16)] backdrop-blur-sm"
								:class="contextMenu.moveMenuSide === 'left' ? 'right-full mr-1.5' : 'left-full ml-1.5'"
								data-testid="card-context-move-menu"
								@mouseenter="openMoveMenu()"
								@mouseleave="scheduleMoveMenuClose()"
							>
								<button
									v-for="targetColumn in availableMoveColumns()"
									:key="targetColumn.id"
									type="button"
									class="trackboi-mono-font flex w-full items-center rounded-[2px] px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary/55"
									:data-testid="`card-context-move-${targetColumn.id}`"
									@click="moveViaContext(targetColumn.id)"
								>
									{{ targetColumn.name }}
								</button>
							</div>
						</div>
						<button
							type="button"
							class="trackboi-mono-font mt-1 flex w-full items-center rounded-[2px] px-2.5 py-1.5 text-left text-[11px] text-destructive hover:bg-destructive/8"
							data-testid="card-context-delete"
							@click="emit('delete', contextMenu.card); closeContextMenu()"
						>
							Delete
						</button>
					</div>
				</Teleport>
			</div>
		</div>
	</section>
</template>
