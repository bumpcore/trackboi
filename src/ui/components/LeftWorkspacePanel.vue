<script setup lang="ts">
import { computed } from "vue";
import { Bot, Plus, Route } from "lucide-vue-next";
import type { ProjectSnapshot, Track, WorktreeContext } from "@/core/types";
import Button from "@/ui/components/Button.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { LeftPanelView } from "@/ui/viewTypes";

const props = defineProps<{
	activeView: LeftPanelView;
	busy: boolean;
	selectedTrackId: string | null;
	selectedTrack: Track | null;
	snapshot: ProjectSnapshot | null;
	trackCounts: Record<string, number>;
	tracks: Track[];
	selectedWorktreeId: string | null;
	worktrees: WorktreeContext[];
}>();

const emit = defineEmits<{
	selectWorktree: [worktreeId: string];
	selectTrack: [trackId: string];
	createTrack: [];
	openProjectSettings: [];
}>();

const shouldShowWorktrees = computed(() => props.worktrees.length > 1);

function worktreeTooltip(worktree: WorktreeContext) {
	return `${worktree.name}${worktree.branch ? ` • ${worktree.branch}` : ""}${worktree.storagePath ? ` • ${worktree.storagePath}` : ""}`;
}

function trackSourceLabel(track: Track) {
	return track.source.kind === "branch" ? track.source.ref : "manual";
}
</script>

<template>
	<aside class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-card/95">
		<div class="app-scroll min-h-0 overflow-y-auto overflow-x-hidden">
			<div v-if="activeView === 'explorer'" class="grid content-start">
				<section class="border-b border-border/70 px-4 py-4">
					<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
					<div class="mt-1 text-sm font-medium text-foreground">{{ snapshot?.project.name ?? "Trackboi" }}</div>
					<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
						<span class="inline-flex h-2 w-2 rounded-full" style="background: hsl(var(--signal-attached));" />
						<span>MCP attached</span>
					</div>
				</section>

				<section class="border-b border-border/70 px-4 py-3">
					<div class="mb-2 flex items-center justify-between gap-3">
						<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tracks</div>
						<Button variant="outline" size="sm" type="button" :disabled="busy" @click="emit('createTrack')">
							<Plus class="h-4 w-4" />
							New
						</Button>
					</div>
					<div class="space-y-1.5">
						<button
							type="button"
							class="shell-sidebar-item w-full"
							:class="{ 'is-active': selectedTrackId == null }"
							@click="emit('selectTrack', '__all__')"
						>
							<span class="inline-flex h-2 w-2 rounded-full bg-foreground" />
							<div class="min-w-0 flex-1">
								<div class="truncate text-foreground">All Work</div>
								<div class="trackboi-mono-font text-[10px] text-muted-foreground">board-wide</div>
							</div>
							<span class="shell-count">{{ snapshot?.cards.filter((card) => !card.parentId).length ?? 0 }}</span>
						</button>

						<button
							v-for="track in tracks"
							:key="track.id"
							type="button"
							class="shell-sidebar-item w-full !items-start"
							:class="{ 'is-active': selectedTrackId === track.id }"
							@click="emit('selectTrack', track.id)"
						>
							<span class="mt-1 inline-flex h-2 w-2 rounded-full bg-primary/90" />
							<div class="min-w-0 flex-1">
								<div class="truncate text-foreground">{{ track.title }}</div>
								<div class="trackboi-mono-font text-[10px] text-muted-foreground">{{ trackSourceLabel(track) }}</div>
							</div>
							<span class="shell-count">{{ trackCounts[track.id] ?? 0 }}</span>
						</button>
					</div>
				</section>

				<section v-if="shouldShowWorktrees" class="px-3 py-3">
					<div class="mb-2 px-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Worktrees</div>
					<div class="space-y-1.5">
						<Tooltip
							v-for="worktree in worktrees"
							:key="worktree.id"
							:content="worktreeTooltip(worktree)"
							side="right"
							wrapper-class="w-full"
						>
							<button
								type="button"
								class="shell-sidebar-item w-full !items-start"
								:class="{ 'is-active': selectedWorktreeId === worktree.id }"
								@click="emit('selectWorktree', worktree.id)"
							>
								<span class="mt-1 inline-flex h-2 w-2 rounded-full bg-primary/90" />
								<div class="min-w-0 flex-1">
									<div class="truncate text-foreground">{{ worktree.name }}</div>
									<div class="font-mono text-[10px] text-muted-foreground">switch workspace context · {{ worktree.branch ?? worktree.path }}</div>
								</div>
							</button>
						</Tooltip>
					</div>
				</section>
			</div>

			<div v-else class="grid content-start gap-3 px-3 py-3">
				<div class="rounded-md border border-border/75 bg-secondary/55 px-3 py-3">
					<div class="flex items-center gap-2 text-sm font-medium text-foreground">
						<Bot class="h-4 w-4" style="color: hsl(var(--signal-attached));" />
						Agent context
					</div>
					<p class="mt-2 text-[12px] leading-5 text-muted-foreground">
						Keep MCP-aware context nearby without turning the desktop shell into a chat surface.
					</p>
				</div>
				<div class="rounded-md border border-border/75 bg-secondary/55 px-3 py-3">
					<div class="flex items-center gap-2 text-sm font-medium text-foreground">
						<Route class="h-4 w-4 text-primary" />
						Track memory
					</div>
					<p class="mt-2 text-[12px] leading-5 text-muted-foreground">
						Tracks keep summary, plan, decisions, files, and activity so the next human or agent can resume work without re-asking for context.
					</p>
				</div>
			</div>
		</div>

		<footer class="border-t border-border/70 px-4 py-3">
			<div class="flex items-center justify-between gap-3">
				<div class="font-mono text-[10px] text-muted-foreground">
					{{ snapshot?.metadata.storagePath ?? ".trackboi" }}
				</div>
				<button
					type="button"
					class="trackboi-mono-font text-[10px] text-muted-foreground transition-colors hover:text-foreground"
					@click="emit('openProjectSettings')"
				>
					Project settings
				</button>
			</div>
		</footer>
	</aside>
</template>
