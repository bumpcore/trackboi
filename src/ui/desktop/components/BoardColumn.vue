<script setup lang="ts">
import { useSortable } from "@vueuse/integrations/useSortable";
import { computed, ref, watch } from "vue";
import { CircleDashed, GripVertical, Plus, Trash2 } from "lucide-vue-next";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import UiCard from "@/ui/components/Card.vue";
import type { Card as TrackboiCard, Column, CustomField, FieldValue } from "@/core/types";

const props = defineProps<{
	column: Column;
	cards: TrackboiCard[];
	childCounts: Record<string, number>;
	customFields: CustomField[];
}>();

const emit = defineEmits<{
	move: [cardId: string, toColumn: string, beforeCardId: string | null];
	create: [columnId: string];
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

function fieldDisplayValue(field: CustomField, value: FieldValue | undefined) {
	if (value == null || value === "" || value === false) return null;
	if (field.type === "checkbox") return value === true ? "Yes" : null;
	return String(value);
}
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
			<div class="flex items-center gap-2">
				<Badge variant="secondary">{{ column.id }}</Badge>
				<Button
					variant="ghost"
					size="icon"
					type="button"
					title="Add card"
					data-sortable-ignore
					@click="emit('create', column.id)"
				>
					<Plus class="h-4 w-4" />
				</Button>
			</div>
		</header>

		<div ref="listElement" class="grid min-h-64 content-start gap-2.5 p-3">
			<div
				v-if="sortableCards.length === 0"
				class="grid min-h-32 place-items-center rounded-md border border-dashed border-border/80 px-6 text-center transition hover:border-primary/50 hover:bg-secondary/40"
				data-sortable-ignore
			>
				<div>
					<CircleDashed class="mx-auto h-5 w-5 text-muted-foreground" />
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
				class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 p-3 transition hover:border-primary/30 hover:bg-secondary/70"
				:data-card-id="card.id"
			>
				<div
					class="mt-0.5 grid h-8 w-5 place-items-center rounded-md text-muted-foreground transition group-hover:bg-muted group-hover:text-foreground"
					aria-hidden="true"
				>
					<GripVertical class="h-4 w-4" />
				</div>
				<button class="min-w-0 bg-transparent text-left" type="button" data-sortable-ignore @click="emit('edit', card)">
					<span class="block [overflow-wrap:anywhere] text-sm font-semibold leading-5 text-foreground">
						{{ card.title }}
					</span>
					<span v-if="card.description" class="mt-1 block [overflow-wrap:anywhere] text-xs leading-5 text-muted-foreground">
						{{ card.description }}
					</span>
					<Badge v-if="card.scope.kind === 'branch'" class="mt-2 max-w-full" variant="outline">
						<span class="truncate">{{ card.scope.ref }}</span>
					</Badge>
					<Badge v-if="props.childCounts[card.id]" class="mt-2" variant="secondary">
						{{ props.childCounts[card.id] }} subtasks
					</Badge>
					<div v-if="props.customFields.length > 0" class="mt-2 flex flex-wrap gap-1.5">
						<Badge
							v-for="field in props.customFields"
							:key="field.id"
							v-show="fieldDisplayValue(field, card.fieldValues[field.id])"
							variant="outline"
							class="max-w-full gap-1"
						>
							<span class="text-muted-foreground">{{ field.name }}</span>
							<span class="truncate">{{ fieldDisplayValue(field, card.fieldValues[field.id]) }}</span>
						</Badge>
					</div>
				</button>
				<Button
					class="opacity-0 transition group-hover:opacity-100"
					variant="ghost"
					size="icon"
					type="button"
					data-sortable-ignore
					@click="emit('delete', card)"
				>
					<Trash2 class="h-4 w-4" />
				</Button>
			</UiCard>
		</div>
	</section>
</template>
