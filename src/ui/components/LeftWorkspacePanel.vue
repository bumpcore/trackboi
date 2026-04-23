<script setup lang="ts">
import { computed } from "vue";
import { Layers3, Plus, Settings } from "lucide-vue-next";
import type { BoardDescriptor, ProjectSnapshot, Track, WorktreeContext } from "@/core/types";
import Button from "@/ui/components/Button.vue";
import Tooltip from "@/ui/components/Tooltip.vue";

const props = defineProps<{
	boards: BoardDescriptor[];
	busy: boolean;
	selectedBoardId: string | null;
	selectedTrackId: string | null;
	selectedTrack: Track | null;
	snapshot: ProjectSnapshot | null;
	trackCounts: Record<string, number>;
	tracks: Track[];
	selectedWorktreeId: string | null;
	worktrees: WorktreeContext[];
}>();

const emit = defineEmits<{
	selectBoard: [boardId: string];
	selectWorktree: [worktreeId: string];
	selectTrack: [trackId: string];
	createBoard: [];
	createTrack: [];
	openBoardSettings: [boardId: string];
}>();

const shouldShowWorktrees = computed(() => props.worktrees.length > 1);

function worktreeTooltip(worktree: WorktreeContext) {
	return `${worktree.name}${worktree.branch ? ` • ${worktree.branch}` : ""}${worktree.storagePath ? ` • ${worktree.storagePath}` : ""}`;
}

function boardStatusLabel(board: BoardDescriptor) {
	return board.status === "stale" ? "stale" : "active in current workspace";
}

function selectBoardWithKeyboard(event: KeyboardEvent, boardId: string) {
	if (event.key !== "Enter" && event.key !== " ") return;
	event.preventDefault();
	emit("selectBoard", boardId);
}
</script>

<template>
	<aside class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-card/95" data-testid="left-workspace-panel">
		<div class="app-scroll min-h-0 overflow-y-auto overflow-x-hidden">
			<div class="grid content-start">
				<section class="border-b border-border/70 px-4 py-4" data-testid="workspace-summary">
					<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
					<div class="mt-1 text-sm font-medium text-foreground">{{ snapshot?.project.name ?? "Trackboi" }}</div>
					<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
						<span class="inline-flex h-2 w-2 rounded-full" style="background: hsl(var(--signal-attached));" />
						<span>MCP attached</span>
					</div>
				</section>

				<section v-if="shouldShowWorktrees" class="px-3 py-3" data-testid="worktree-list">
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
								:data-testid="`worktree-${worktree.id}`"
								@click="emit('selectWorktree', worktree.id)"
							>
								<span class="mt-1 inline-flex h-2 w-2 rounded-full bg-primary/90" />
								<div class="w-0 flex-1 overflow-hidden">
									<div class="w-full truncate text-foreground">{{ worktree.name }}</div>
									<div class="w-full truncate font-mono text-[10px] text-muted-foreground">switch workspace context · {{ worktree.branch ?? worktree.path }}</div>
								</div>
							</button>
						</Tooltip>
					</div>
				</section>

				<section v-if="snapshot" class="border-t border-border/70 px-4 py-3" data-testid="board-list">
					<div class="mb-2 flex items-center justify-between gap-3">
						<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Boards</div>
						<Tooltip content="New board" side="right">
							<Button
								variant="ghost"
								size="icon"
								type="button"
								:disabled="busy"
								data-testid="board-create-button"
								@click="emit('createBoard')"
							>
								<Plus class="h-4 w-4" />
							</Button>
						</Tooltip>
					</div>
					<div class="space-y-1.5">
						<div
							v-for="board in boards"
							:key="board.id"
							role="button"
							tabindex="0"
							class="shell-sidebar-item group w-full"
							:class="{ 'is-active': (selectedBoardId ?? snapshot.board.id) === board.id }"
							:data-testid="`board-${board.id}`"
							@click="emit('selectBoard', board.id)"
							@keydown="selectBoardWithKeyboard($event, board.id)"
						>
							<Layers3 class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							<div class="w-0 flex-1 overflow-hidden">
								<div class="w-full truncate text-foreground">{{ board.name }}</div>
								<div class="w-full truncate trackboi-mono-font text-[10px] text-muted-foreground">{{ boardStatusLabel(board) }}</div>
							</div>
							<Tooltip content="Board settings" side="right">
								<Button
									variant="ghost"
									size="icon"
									type="button"
									class="-mr-1 h-6 w-6 shrink-0 self-center opacity-65 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
									:disabled="busy"
									:data-testid="`board-settings-${board.id}`"
									@click.stop="emit('openBoardSettings', board.id)"
								>
									<Settings class="h-3.5 w-3.5" />
								</Button>
							</Tooltip>
						</div>
					</div>
				</section>

				<section class="border-t border-border/70 px-4 py-3" data-testid="track-list">
					<div class="mb-2 flex items-center justify-between gap-3">
						<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tracks</div>
						<Button variant="outline" size="sm" type="button" data-testid="create-track-button" :disabled="busy" @click="emit('createTrack')">
							New
						</Button>
					</div>
					<div class="space-y-1.5">
						<button
							type="button"
							class="shell-sidebar-item w-full"
							:class="{ 'is-active': selectedTrackId == null }"
							data-testid="track-all-work"
							@click="emit('selectTrack', '__all__')"
						>
							<span class="inline-flex h-2 w-2 rounded-full bg-foreground" />
							<div class="w-0 flex-1 overflow-hidden">
								<div class="w-full truncate text-foreground">All Work</div>
								<div class="w-full truncate trackboi-mono-font text-[10px] text-muted-foreground">board-wide</div>
							</div>
							<span class="shell-count">{{ snapshot?.cards.filter((card) => !card.parentId).length ?? 0 }}</span>
						</button>

						<button
							v-for="track in tracks"
							:key="track.id"
							type="button"
							class="shell-sidebar-item w-full !items-start"
							:class="{ 'is-active': selectedTrackId === track.id }"
							:data-testid="`track-${track.id}`"
							@click="emit('selectTrack', track.id)"
						>
							<span class="mt-1 inline-flex h-2 w-2 rounded-full bg-primary/90" />
							<div class="w-0 flex-1 overflow-hidden">
								<div class="w-full truncate text-foreground">{{ track.title }}</div>
								<div class="w-full truncate trackboi-mono-font text-[10px] text-muted-foreground">{{ track.summary || track.brief || "track context" }}</div>
							</div>
							<span class="shell-count">{{ trackCounts[track.id] ?? 0 }}</span>
						</button>
					</div>
				</section>
			</div>
		</div>

		<footer class="border-t border-border/70 px-4 py-3">
			<div class="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
				{{ snapshot?.project.storagePath ?? ".trackboi" }}
			</div>
		</footer>
	</aside>
</template>
