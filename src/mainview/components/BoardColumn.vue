<script setup lang="ts">
import { useSortable } from "@vueuse/integrations/useSortable";
import { computed, ref, watch } from "vue";
import { CircleDashed, GripVertical, Trash2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UiCard } from "@/components/ui/card";
import type { Card as TrackboiCard, Column } from "../../shared/types";

const props = defineProps<{
	column: Column;
	cards: TrackboiCard[];
}>();

const emit = defineEmits<{
	move: [cardId: string, toColumn: string, beforeCardId: string | null];
	edit: [card: TrackboiCard];
	delete: [card: TrackboiCard];
}>();

const listElement = ref<HTMLElement | null>(null);
const sortableCards = ref<TrackboiCard[]>([]);

const sortedCards = computed(() =>
	[...props.cards].sort((left, right) => left.rank.localeCompare(right.rank)),
);

watch(
	sortedCards,
	(cards) => {
		sortableCards.value = cards;
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
	onEnd(event) {
		const cardId = (event.item as HTMLElement | null)?.dataset.cardId;
		if (!cardId || event.to !== listElement.value) return;

		const nextSibling = event.item.nextElementSibling as HTMLElement | null;
		emit("move", cardId, props.column.id, nextSibling?.dataset.cardId ?? null);
	},
});
</script>

<template>
	<section
		class="min-w-72 rounded-lg border border-border/80 bg-card/70"
		:data-column-id="column.id"
	>
		<header class="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
			<div>
				<h2 class="text-sm font-semibold text-foreground">{{ column.name }}</h2>
				<p class="mt-1 text-xs text-muted-foreground">{{ sortedCards.length }} cards</p>
			</div>
			<Badge variant="secondary">{{ column.id }}</Badge>
		</header>

		<div ref="listElement" class="grid min-h-64 content-start gap-2.5 p-3">
			<div
				v-if="sortableCards.length === 0"
				class="grid min-h-32 place-items-center rounded-md border border-dashed border-border/80 px-6 text-center"
				data-sortable-ignore
			>
				<div>
					<CircleDashed class="mx-auto h-5 w-5 text-muted-foreground" />
					<p class="mt-2 text-xs font-medium text-muted-foreground">Drop cards here</p>
				</div>
			</div>

			<UiCard
				v-for="card in sortableCards"
				:key="card.id"
				class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 p-3 transition hover:border-primary/30 hover:bg-secondary/70"
				:data-card-id="card.id"
			>
				<div
					class="mt-0.5 grid h-8 w-5 place-items-center rounded-md text-muted-foreground transition group-hover:bg-muted group-hover:text-foreground"
					aria-hidden="true"
				>
					<GripVertical class="h-4 w-4" />
				</div>
				<button class="min-w-0 bg-transparent text-left" type="button" @click="emit('edit', card)">
					<span class="block [overflow-wrap:anywhere] text-sm font-semibold leading-5 text-foreground">
						{{ card.title }}
					</span>
					<span v-if="card.description" class="mt-1 block [overflow-wrap:anywhere] text-xs leading-5 text-muted-foreground">
						{{ card.description }}
					</span>
					<Badge v-if="card.scope.kind === 'branch'" class="mt-2 max-w-full" variant="outline">
						<span class="truncate">{{ card.scope.ref }}</span>
					</Badge>
				</button>
				<Button
					class="opacity-0 transition group-hover:opacity-100"
					variant="ghost"
					size="icon"
					type="button"
					@click="emit('delete', card)"
				>
					<Trash2 class="h-4 w-4" />
				</Button>
			</UiCard>
		</div>
	</section>
</template>
