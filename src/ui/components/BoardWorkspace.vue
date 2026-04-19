<script setup lang="ts">
import { computed } from "vue";
import { FolderOpen, Plus } from "lucide-vue-next";
import type { Card as TrackboiCard, CustomField, ProjectEntry, ProjectSnapshot, Track, WorktreeContext } from "@/core/types";
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
	scopeEmptyMessage: string | null;
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
	editCard: [card: TrackboiCard];
	deleteCard: [card: TrackboiCard];
	freshSeen: [cardId: string];
	moveCard: [cardId: string, toColumn: string, beforeCardId: string | null];
}>();

const boardSubtitle = computed(() => {
	if (props.selectedTrack) {
		return `${props.selectedTrack.title} · filtered workspace view with ${props.visibleCardCount} visible cards`;
	}
	if (props.selectedWorktree) {
		return `${props.selectedWorktree.name} · filtered worktree view with ${props.visibleCardCount} visible cards`;
	}
	return `Board-wide workspace view with ${props.visibleCardCount} visible cards`;
});

function forwardMove(cardId: string, toColumn: string, beforeCardId: string | null) {
	emit("moveCard", cardId, toColumn, beforeCardId);
}
</script>

<template>
	<main class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
		<header class="border-b border-border/65 px-5 py-4">
			<div class="flex items-start justify-between gap-4">
				<div>
					<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Board</div>
					<h1 class="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
						{{ activeProject?.name ?? snapshot?.project.name ?? "Trackboi" }} / {{ snapshot?.board.name ?? "Delivery" }}
					</h1>
					<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
						<span class="inline-flex rounded-[4px] border border-border/70 bg-secondary/85 px-2 py-1 font-mono text-foreground">
							{{ visibleCardCount }} shown
						</span>
						<span
							v-if="snapshot"
							class="inline-flex rounded-[4px] border border-border/70 bg-secondary/85 px-2 py-1 font-mono text-foreground"
						>
							{{ snapshot.cards.filter((card) => !card.parentId && card.column === 'doing').length }} in progress
						</span>
						<span
							v-if="snapshot"
							class="inline-flex rounded-[4px] border border-border/70 bg-secondary/85 px-2 py-1 font-mono text-foreground"
						>
							storage: {{ snapshot.metadata.storagePath }}
						</span>
					</div>
					<div class="mt-2 font-mono text-[11px] text-muted-foreground">{{ boardSubtitle }}</div>
				</div>

				<div class="flex items-center gap-2">
					<Button
						v-if="snapshot"
						type="button"
						:disabled="busy"
						@click="emit('createCard')"
					>
						<Plus class="h-4 w-4" />
						New Card
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
						<FolderOpen class="h-4 w-4" />
						Choose project
					</Button>
				</div>
			</UiCard>

			<div v-else class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4">
				<div class="app-scroll min-h-0 overflow-x-auto overflow-y-hidden">
					<div class="grid h-full min-w-max grid-flow-col auto-cols-[356px] items-stretch gap-4 px-5">
						<BoardColumn
							v-for="column in snapshot.board.columns"
							:key="column.id"
							:column="column"
							:cards="cardsByColumn[column.id] ?? []"
							:child-progress="childProgress"
							:custom-fields="customFields"
							:fresh-card-ids="freshCardIds"
							:selected-card-id="selectedCardId ?? null"
							:track-labels="trackLabels"
							@move="forwardMove"
							@create="emit('createCard', $event)"
							@edit="emit('editCard', $event)"
							@delete="emit('deleteCard', $event)"
							@fresh-seen="emit('freshSeen', $event)"
						/>

						<button
							type="button"
							class="group flex h-full min-h-0 flex-col items-center justify-center rounded-[6px] border border-dashed border-border/70 bg-secondary/[0.18] px-6 py-6 text-center transition-colors hover:border-primary/30 hover:bg-secondary/[0.26] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							@click="emit('createColumn')"
						>
							<span
								class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-border/70 bg-background/70 text-muted-foreground transition-colors group-hover:border-primary/35 group-hover:text-primary"
							>
								<Plus class="h-4 w-4" />
							</span>
							<span class="font-medium text-foreground">Add a column</span>
							<span class="mt-1 text-sm text-muted-foreground">Expand the board with another workflow step.</span>
						</button>
					</div>
				</div>

				<p v-if="scopeEmptyMessage" class="px-5 text-sm text-muted-foreground">
					{{ scopeEmptyMessage }}
				</p>
			</div>
		</div>
	</main>
</template>
