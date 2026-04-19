<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { FileText, Layers3, Route, SquarePen } from "lucide-vue-next";
import type { Card as TrackboiCard, CustomField, Track, TrackPatch } from "@/core/types";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import CardEditorPanel from "@/ui/components/CardEditorPanel.vue";
import MarkdownContent from "@/ui/components/MarkdownContent.vue";
import TrackEditorPanel from "@/ui/components/TrackEditorPanel.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { CardDraft, ChildProgress, FieldValuesDraft, RightPanelView } from "@/ui/viewTypes";

const props = defineProps<{
	activeView: RightPanelView;
	busy: boolean;
	collapsed: boolean;
	card: TrackboiCard | null;
	cardMode: "closed" | "create" | "edit";
	cardTrack: Track | null;
	columnOptions: SelectOption[];
	commentList: TrackboiCard["comments"];
	currentBranch: string | null;
	customFields: CustomField[];
	actorLabels: Record<string, string>;
	subtaskProgress: ChildProgress;
	subtasks: TrackboiCard[];
	track: Track | null;
	trackMode: "create" | "edit";
	trackOptions: SelectOption[];
	trackFileName: string;
	trackFileContent: string;
	linkedTrackCards: TrackboiCard[];
}>();

const draft = defineModel<CardDraft>("draft", { required: true });
const trackId = defineModel<string>("trackId", { required: true });
const fieldValues = defineModel<FieldValuesDraft>("fieldValues", { required: true });
const commentBody = defineModel<string>("commentBody", { required: true });
const subtaskTitle = defineModel<string>("subtaskTitle", { required: true });

const emit = defineEmits<{
	selectView: [view: RightPanelView];
	submitCard: [];
	deleteCard: [card: TrackboiCard];
	addCardComment: [];
	createSubtask: [];
	editSubtask: [card: TrackboiCard];
	saveTrack: [patch: Required<Pick<TrackPatch, "title" | "source" | "summary" | "plan" | "decisions" | "references" | "activity">>];
	deleteTrack: [track: Track];
	loadTrackFile: [fileName: string];
	writeTrackFile: [fileName: string, content: string];
	deleteTrackFile: [fileName: string];
	editTrackCard: [card: TrackboiCard];
}>();

const rightItems: Array<{ id: RightPanelView; label: string; icon: typeof SquarePen }> = [
	{ id: "card", label: "Card", icon: SquarePen },
	{ id: "track", label: "Track", icon: Route },
	{ id: "activity", label: "Activity", icon: Layers3 },
	{ id: "context", label: "Context", icon: FileText },
];

const title = computed(() => {
	if (props.activeView === "track") {
		return props.trackMode === "create" ? "New track" : (props.track?.title ?? "Track");
	}
	if (props.activeView === "card") {
		return props.cardMode === "create" ? "New card" : (props.card?.title ?? "Card detail workspace");
	}
	if (props.activeView === "activity") {
		return props.card?.title ?? props.track?.title ?? "Activity";
	}
	return props.card?.title ?? props.track?.title ?? "Context";
});

const showCardTrackInline = computed(() => props.activeView === "card" && props.cardTrack != null);
const trackEditor = useTemplateRef<InstanceType<typeof TrackEditorPanel>>("trackEditor");
const showFooterActions = computed(() => (
	(props.activeView === "card" && (props.cardMode === "create" || props.card != null))
	|| (props.activeView === "track" && (props.trackMode === "create" || props.track != null))
));

function forwardWriteTrackFile(fileName: string, content: string) {
	emit("writeTrackFile", fileName, content);
}

function submitTrackFromFooter() {
	trackEditor.value?.saveTrack();
}
</script>

<template>
	<aside class="grid h-full min-h-0 bg-card/95" :class="collapsed ? 'grid-cols-[44px]' : 'grid-cols-[minmax(0,1fr)]'">
		<div v-if="collapsed" class="border-l border-border/70 bg-card/95">
			<div class="flex h-full flex-col items-center gap-2 py-3">
				<button
					v-for="item in rightItems"
					:key="item.id"
					type="button"
					class="shell-rail-button"
					:class="{ 'is-active': activeView === item.id }"
					@click="emit('selectView', item.id)"
				>
					<component :is="item.icon" class="h-4 w-4" />
				</button>
			</div>
		</div>

		<div v-else class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-l border-border/70">
			<header class="border-b border-border/70 px-5 py-4">
				<div class="mb-3 flex items-center gap-3">
					<div class="flex flex-wrap items-center gap-1">
						<Tooltip
							v-for="item in rightItems"
							:key="item.id"
							:content="item.label"
							side="bottom"
						>
							<button
								type="button"
								class="shell-rail-button"
								:class="{ 'is-active': activeView === item.id }"
								@click="emit('selectView', item.id)"
							>
								<component :is="item.icon" class="h-4 w-4" />
							</button>
						</Tooltip>
					</div>
				</div>

				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h2 class="text-lg font-semibold tracking-tight text-foreground">{{ title }}</h2>
						<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
							<Badge v-if="card" variant="outline">{{ card.column }}</Badge>
							<Badge v-if="cardTrack" variant="outline" class="text-primary">{{ cardTrack.title }}</Badge>
							<Badge v-if="track?.source.kind === 'branch'" variant="outline">{{ track.source.ref }}</Badge>
						</div>
					</div>
				</div>

				<div v-if="showCardTrackInline" class="mt-3 rounded-md border border-border/80 bg-secondary/55 px-3 py-3">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Track container</div>
							<div class="mt-1 text-sm font-medium text-foreground">{{ cardTrack?.title }}</div>
							<p class="mt-1 text-[12px] leading-5 text-muted-foreground">{{ cardTrack?.summary }}</p>
						</div>
						<div class="text-right font-mono text-[10px] text-muted-foreground">
							<div>{{ linkedTrackCards.length }} linked cards</div>
							<div v-if="cardTrack?.files[0]" class="mt-1 truncate">file: {{ cardTrack.files[0].name }}</div>
						</div>
					</div>
				</div>
			</header>

			<div class="app-scroll min-h-0 overflow-auto px-5 py-4">
				<CardEditorPanel
					v-if="activeView === 'card' && (cardMode === 'create' || card)"
					v-model:draft="draft"
					v-model:track-id="trackId"
					v-model:field-values="fieldValues"
					v-model:comment-body="commentBody"
					v-model:subtask-title="subtaskTitle"
					:busy="busy"
					:card="card"
					:mode="cardMode === 'create' ? 'create' : 'edit'"
					:column-options="columnOptions"
					:track-options="trackOptions"
					:custom-fields="customFields"
					:comments="commentList"
					:actor-labels="actorLabels"
					:subtasks="subtasks"
					:subtask-progress="subtaskProgress"
					@submit="emit('submitCard')"
					@delete="emit('deleteCard', $event)"
					@add-comment="emit('addCardComment')"
					@create-subtask="emit('createSubtask')"
					@edit-subtask="emit('editSubtask', $event)"
				/>

				<div v-else-if="activeView === 'card'" class="grid place-items-center py-16 text-center">
					<div class="max-w-xs">
						<p class="text-sm font-medium text-foreground">Select a card</p>
						<p class="mt-2 text-sm leading-6 text-muted-foreground">
							The right panel becomes the task workspace for the selected card, or opens directly into create mode when you add a new card.
						</p>
					</div>
				</div>

				<TrackEditorPanel
					v-else-if="activeView === 'track' && (trackMode === 'create' || track)"
					ref="trackEditor"
					:busy="busy"
					:mode="trackMode"
					:track="track"
					:current-branch="currentBranch"
					:linked-cards="linkedTrackCards"
					:selected-file-name="trackFileName"
					:selected-file-content="trackFileContent"
					@save="emit('saveTrack', $event)"
					@delete="emit('deleteTrack', $event)"
					@load-file="emit('loadTrackFile', $event)"
					@write-file="forwardWriteTrackFile"
					@delete-file="emit('deleteTrackFile', $event)"
					@edit-card="emit('editTrackCard', $event)"
				/>

				<div v-else-if="activeView === 'track'" class="grid place-items-center py-16 text-center">
					<div class="max-w-xs">
						<p class="text-sm font-medium text-foreground">Select a track</p>
						<p class="mt-2 text-sm leading-6 text-muted-foreground">
							Tracks stay first-class, but they now live in the shared right-side workspace instead of a competing drawer above the board.
						</p>
					</div>
				</div>

				<div v-else-if="activeView === 'activity'" class="grid content-start gap-4">
					<section class="shell-section">
						<div>
							<p class="shell-section-title">Comments / Activity</p>
							<p class="mt-1 text-sm text-muted-foreground">
								{{ card ? "Task memory attached to the selected card." : "Track activity attached to the selected work container." }}
							</p>
						</div>
						<div v-if="card && commentList.length > 0" class="grid gap-3">
							<div
								v-for="comment in commentList"
								:key="comment.id"
								class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3"
							>
								<div class="text-sm font-medium text-foreground">{{ actorLabels[comment.createdBy] ?? comment.createdBy }}</div>
								<MarkdownContent :value="comment.body" class="mt-2 text-sm text-foreground" />
							</div>
						</div>
						<div v-else-if="track && track.activity.length > 0" class="grid gap-3">
							<div
								v-for="entry in track.activity"
								:key="entry.id"
								class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3"
							>
								<div class="text-sm font-medium text-foreground">{{ actorLabels[entry.createdBy] ?? entry.createdBy }}</div>
								<MarkdownContent :value="entry.body" class="mt-2 text-sm text-foreground" />
							</div>
						</div>
						<p v-else class="text-sm text-muted-foreground">Nothing recorded here yet.</p>
					</section>
				</div>

				<div v-else-if="activeView === 'context'" class="grid content-start gap-4">
					<section class="shell-section">
						<div>
							<p class="shell-section-title">Track context</p>
							<p class="mt-1 text-sm text-muted-foreground">Keep related track context, files, references, and metadata nearby.</p>
						</div>
						<div v-if="cardTrack || track" class="grid gap-3">
							<div class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3">
								<div class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Summary</div>
								<p class="mt-2 text-sm leading-6 text-foreground">{{ (cardTrack ?? track)?.summary }}</p>
							</div>
							<div class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3">
								<div class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Plan</div>
								<p class="mt-2 text-sm leading-6 text-muted-foreground">{{ (cardTrack ?? track)?.plan }}</p>
							</div>
							<div class="grid gap-3 md:grid-cols-2">
								<div class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3">
									<div class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Decisions</div>
									<div class="mt-2 space-y-2">
										<div
											v-for="decision in (cardTrack ?? track)?.decisions ?? []"
											:key="decision.id"
											class="rounded-md border border-border/70 bg-background/20 px-2 py-2"
										>
											<div class="text-sm font-medium text-foreground">{{ decision.title }}</div>
											<div class="mt-1 text-xs text-muted-foreground">{{ decision.status }}</div>
										</div>
									</div>
								</div>
								<div class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3">
									<div class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">References & files</div>
									<div class="mt-2 space-y-2">
										<div
											v-for="reference in (cardTrack ?? track)?.references ?? []"
											:key="reference.id"
											class="rounded-md border border-border/70 bg-background/20 px-2 py-2"
										>
											<div class="text-sm font-medium text-foreground">{{ reference.label }}</div>
											<div class="mt-1 text-xs text-muted-foreground">{{ reference.value }}</div>
										</div>
										<div
											v-for="file in (cardTrack ?? track)?.files ?? []"
											:key="file.name"
											class="rounded-md border border-border/70 bg-background/20 px-2 py-2"
										>
											<div class="text-sm font-medium text-foreground">{{ file.name }}</div>
											<div class="mt-1 text-xs text-muted-foreground">{{ file.path }}</div>
										</div>
									</div>
								</div>
							</div>
						</div>
						<p v-else class="text-sm text-muted-foreground">Select a card with a track or an active track to inspect context here.</p>
					</section>
				</div>

			</div>

			<footer class="border-t border-border/70 px-5 py-3">
				<div v-if="showFooterActions" class="flex items-center justify-end gap-2">
					<template v-if="activeView === 'card' && (cardMode === 'create' || card)">
						<Button
							v-if="cardMode !== 'create' && card"
							variant="outline"
							type="button"
							:disabled="busy"
							@click="emit('deleteCard', card)"
						>
							Delete
						</Button>
						<Button type="button" :disabled="busy || !draft.title.trim()" @click="emit('submitCard')">
							{{ cardMode === "create" ? "Create Card" : "Save Card" }}
						</Button>
					</template>

					<template v-else-if="activeView === 'track' && (trackMode === 'create' || track)">
						<Button
							v-if="trackMode === 'edit' && track"
							variant="outline"
							type="button"
							:disabled="busy"
							@click="emit('deleteTrack', track)"
						>
							Delete
						</Button>
						<Button type="button" :disabled="busy" @click="submitTrackFromFooter">
							{{ trackMode === "create" ? "Create Track" : "Save Track" }}
						</Button>
					</template>

				</div>
			</footer>
		</div>
	</aside>
</template>
