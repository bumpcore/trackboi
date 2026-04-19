<script setup lang="ts">
import { useSortable } from "@vueuse/integrations/useSortable";
import { ref, watch } from "vue";
import { CircleDashed, Plus, Trash2 } from "lucide-vue-next";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import MarkdownContent from "@/ui/components/MarkdownContent.vue";
import MarkdownInline from "@/ui/components/MarkdownInline.vue";
import UiCard from "@/ui/components/Card.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { Card as TrackboiCard, Column, CustomField, FieldValue } from "@/core/types";

const props = defineProps<{
	column: Column;
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
	edit: [card: TrackboiCard];
	delete: [card: TrackboiCard];
	freshSeen: [cardId: string];
}>();

const listElement = ref<HTMLElement | null>(null);
const sortableCards = ref<TrackboiCard[]>([]);
let suppressActivation = false;
let activationResetTimer: number | null = null;

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
	emit("edit", card);
}
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

		<div ref="listElement" class="app-scroll flex min-h-0 flex-col gap-2.5 overflow-y-auto p-3">
			<div
				v-if="sortableCards.length === 0"
				class="grid min-h-28 shrink-0 place-items-center rounded-[8px] border border-dashed border-border/55 bg-background/16 px-6 text-center transition hover:border-primary/35 hover:bg-secondary/25"
				data-sortable-ignore
			>
				<div>
					<CircleDashed class="mx-auto h-4 w-4 text-muted-foreground" />
					<p class="mt-2 text-xs font-medium text-muted-foreground">Drop cards here</p>
					<Button class="mt-3" variant="ghost" size="sm" type="button" @click="emit('create', column.id)">
						<Plus class="h-3.5 w-3.5" />
						Add card
					</Button>
				</div>
			</div>

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
				@mouseenter="emit('freshSeen', card.id)"
				@keydown.enter.prevent="activateCard(card)"
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
	</section>
</template>
