<script setup lang="ts">
import { useSortable } from "@vueuse/integrations/useSortable";
import { onBeforeUnmount, ref, watch } from "vue";
import { ChevronRight, CircleDashed, Plus, Trash2 } from "lucide-vue-next";
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
	select: [card: TrackboiCard];
	edit: [card: TrackboiCard];
	delete: [card: TrackboiCard];
	openInEditor: [card: TrackboiCard];
	freshSeen: [cardId: string];
}>();

const listElement = ref<HTMLElement | null>(null);
const sortableCards = ref<TrackboiCard[]>([]);
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
let suppressActivation = false;
let activationResetTimer: number | null = null;
let moveMenuCloseTimer: number | null = null;

watch(
	() => props.cards,
	(cards) => {
		sortableCards.value = [...cards];
	},
	{ immediate: true },
);

useSortable(listElement, sortableCards, {
	group: "trackboi-cards",
	animation: 140,
	dataIdAttr: "data-card-id",
	draggable: "[data-card-id]",
	ghostClass: "card-ghost",
	dragClass: "card-dragging",
	filter: "[data-sortable-ignore]",
	onStart() {
		suppressActivation = true;
		if (activationResetTimer !== null) {
			window.clearTimeout(activationResetTimer);
			activationResetTimer = null;
		}
	},
	onEnd(event) {
		const cardId = (event.item as HTMLElement | null)?.dataset.cardId;
		activationResetTimer = window.setTimeout(() => {
			suppressActivation = false;
			activationResetTimer = null;
		}, 120);
		if (!cardId || event.to !== listElement.value) return;

		const nextSibling = event.item.nextElementSibling as HTMLElement | null;
		emit("move", cardId, props.column.id, nextSibling?.dataset.cardId ?? null);
	},
});

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

onBeforeUnmount(() => {
	window.removeEventListener("pointerdown", handlePointerDown);
	if (moveMenuCloseTimer !== null) {
		window.clearTimeout(moveMenuCloseTimer);
	}
});
</script>

<template>
	<section
		class="column-shell grid h-full min-h-0 w-[356px] min-w-[356px] max-w-[356px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-border/70 bg-secondary/45 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)]"
		:data-column-id="column.id"
	>
		<header class="flex items-start justify-between gap-3 border-b border-border/55 px-4 py-3">
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-primary/90" aria-hidden="true" />
					<h2 class="truncate text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground/94">{{ column.name }}</h2>
				</div>
				<p class="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{{ props.cards.length }} cards</p>
			</div>
			<div class="flex items-center gap-2">
				<Tooltip content="Add card" side="left">
					<Button
						variant="ghost"
						size="icon"
						class="rounded-[8px] border border-transparent hover:border-border/60 hover:bg-background/70"
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
			<div class="relative min-h-full">
				<div ref="listElement" class="flex min-h-full flex-col gap-2.5 px-2.5 py-3">
				<UiCard
					v-for="card in sortableCards"
					:key="card.id"
					class="board-card group relative grid w-full min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 overflow-hidden p-3 transition"
					:data-card-id="card.id"
					:data-fresh="props.freshCardIds?.has(card.id) ?? false"
					:data-selected="props.selectedCardId === card.id"
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
						class="mt-0.5 rounded-[6px] border border-transparent opacity-0 transition group-hover:border-border/55 group-hover:bg-background/72 group-hover:opacity-100"
						variant="ghost"
						size="icon"
						type="button"
						data-sortable-ignore
						@click.stop="emit('delete', card)"
					>
						<Trash2 class="h-4 w-4" />
					</Button>
				</UiCard>
				</div>

				<Teleport to="body">
					<div
						v-if="contextMenu"
						class="fixed z-[80] min-w-36 rounded-[7px] border border-border/75 bg-card/98 p-1 shadow-[0_18px_34px_hsl(0_0%_0%/0.16)] backdrop-blur-sm"
						:style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
						data-sortable-ignore
						@pointerdown.stop
						@click.stop
					>
						<button
							type="button"
							class="trackboi-mono-font flex w-full items-center rounded-[5px] px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary/55"
							@click="openCardEditor(contextMenu.card); closeContextMenu()"
						>
							Edit
						</button>
						<button
							type="button"
							class="trackboi-mono-font flex w-full items-center rounded-[5px] px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary/55"
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
								class="trackboi-mono-font flex w-full items-center justify-between rounded-[5px] px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary/55"
								@click="contextMenu.moveOpen = !contextMenu.moveOpen"
							>
								<span>Move to</span>
								<ChevronRight class="h-3 w-3 text-muted-foreground" />
							</button>
							<div
								v-if="contextMenu.moveOpen"
								class="absolute top-0 z-[81] min-w-32 rounded-[7px] border border-border/75 bg-card/98 p-1 shadow-[0_18px_34px_hsl(0_0%_0%/0.16)] backdrop-blur-sm"
								:class="contextMenu.moveMenuSide === 'left' ? 'right-full mr-1.5' : 'left-full ml-1.5'"
								@mouseenter="openMoveMenu()"
								@mouseleave="scheduleMoveMenuClose()"
							>
								<button
									v-for="targetColumn in availableMoveColumns()"
									:key="targetColumn.id"
									type="button"
									class="trackboi-mono-font flex w-full items-center rounded-[5px] px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary/55"
									@click="moveViaContext(targetColumn.id)"
								>
									{{ targetColumn.name }}
								</button>
							</div>
						</div>
						<button
							type="button"
							class="trackboi-mono-font mt-1 flex w-full items-center rounded-[5px] px-2.5 py-1.5 text-left text-[11px] text-destructive hover:bg-destructive/8"
							@click="emit('delete', contextMenu.card); closeContextMenu()"
						>
							Delete
						</button>
					</div>
				</Teleport>

				<div
					v-if="sortableCards.length === 0"
					class="pointer-events-none absolute inset-x-2.5 inset-y-3 grid place-items-center"
					data-sortable-ignore
				>
					<div class="grid min-h-28 w-full place-items-center rounded-[8px] border border-dashed border-border/55 bg-background/16 px-6 text-center transition hover:border-primary/35 hover:bg-secondary/25">
						<div class="pointer-events-auto">
							<CircleDashed class="mx-auto h-4 w-4 text-muted-foreground" />
							<p class="mt-2 text-xs font-medium text-muted-foreground">Drop cards here</p>
							<Button class="mt-3" variant="ghost" size="sm" type="button" @click="emit('create', column.id)">
								<Plus class="h-3.5 w-3.5" />
								Add card
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
