<script setup lang="ts">
import { useSortable } from "@vueuse/integrations/useSortable";
import { ref, watch } from "vue";
import { CircleDashed, GripVertical, Plus, Trash2 } from "lucide-vue-next";
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
	trackLabels: Record<string, string>;
}>();

const emit = defineEmits<{
	move: [cardId: string, toColumn: string, beforeCardId: string | null];
	create: [columnId: string];
	edit: [card: TrackboiCard];
	delete: [card: TrackboiCard];
}>();

const listElement = ref<HTMLElement | null>(null);
const sortableCards = ref<TrackboiCard[]>([]);

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

function visibleFieldEntries(card: TrackboiCard) {
	return props.customFields.flatMap((field) => {
		const value = fieldDisplayValue(field, card.fieldValues[field.id]);
		return value ? [{ field, value }] : [];
	});
}
</script>

<template>
	<section
		class="column-shell w-[356px] min-w-[356px] max-w-[356px] rounded-[14px] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--card)/0.82)_0%,hsl(var(--background)/0.92)_100%)] shadow-[0_1px_0_hsl(0_0%_100%/0.02),0_18px_34px_hsl(0_0%_0%/0.18)]"
		:data-column-id="column.id"
	>
		<header class="flex items-start justify-between gap-3 border-b border-border/45 px-4 py-3.5">
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-primary/90 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]" aria-hidden="true" />
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

		<div ref="listElement" class="grid min-h-56 content-start gap-2.5 p-3">
			<div
				v-if="sortableCards.length === 0"
				class="grid min-h-28 place-items-center rounded-[12px] border border-dashed border-border/45 bg-background/18 px-6 text-center transition hover:border-primary/35 hover:bg-secondary/25"
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
				class="board-card group relative grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 overflow-hidden p-3 transition"
				:data-card-id="card.id"
			>
				<div class="board-card__rail absolute inset-y-0 left-0 w-[3px] bg-linear-to-b from-primary/70 via-primary/18 to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
				<div
					class="mt-0.5 grid h-8 w-5 place-items-center rounded-[8px] border border-transparent text-muted-foreground transition group-hover:border-border/55 group-hover:bg-background/72 group-hover:text-foreground"
					aria-hidden="true"
				>
					<GripVertical class="h-4 w-4" />
				</div>
				<div
					class="min-w-0 max-w-full cursor-pointer bg-transparent text-left"
					role="button"
					tabindex="0"
					data-sortable-ignore
					@click="emit('edit', card)"
					@keydown.enter.prevent="emit('edit', card)"
					@keydown.space.prevent="emit('edit', card)"
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
					class="mt-0.5 rounded-[8px] border border-transparent opacity-0 transition group-hover:border-border/55 group-hover:bg-background/72 group-hover:opacity-100"
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
