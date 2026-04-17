<script setup lang="ts">
import { computed } from "vue";
import { Check, ChevronDown } from "lucide-vue-next";
import {
	SelectContent,
	SelectIcon,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	SelectPortal,
	SelectRoot,
	SelectTrigger,
	SelectValue,
	SelectViewport,
} from "reka-ui";
import Badge from "@/ui/components/Badge.vue";
import type { WorktreeContext } from "@/core/types";
import { projectColorStyle } from "@/ui/lib/projectColor";

const props = defineProps<{
	worktrees: WorktreeContext[];
	selectedWorktreeId: string | null;
	busy: boolean;
}>();

const emit = defineEmits<{
	selectWorktree: [worktreeId: string];
}>();

const selectedWorktree = computed(() => (
	props.worktrees.find((worktree) => worktree.id === props.selectedWorktreeId) ?? props.worktrees[0] ?? null
));

function projectInitial(name: string) {
	return name.slice(0, 1).toUpperCase();
}

function selectWorktree(worktreeId: string) {
	emit("selectWorktree", worktreeId);
}
</script>

<template>
	<div class="grid gap-2 border-t border-border/45 bg-background/20 px-5 py-2">
		<div class="flex min-w-0 items-center justify-between gap-3">
			<div class="w-24 shrink-0">
				<p class="text-[11px] font-semibold uppercase text-muted-foreground">
					Worktrees
				</p>
			</div>

			<SelectRoot
				v-if="selectedWorktree"
				:model-value="selectedWorktree.id"
				:disabled="busy"
				@update:model-value="selectWorktree"
			>
				<SelectTrigger
					class="flex h-8 min-w-0 max-w-[min(56vw,520px)] items-center gap-2 rounded-md border border-border/60 bg-card/55 px-2.5 text-sm text-foreground outline-none transition-colors hover:bg-accent/55 focus-visible:ring-1 focus-visible:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
				>
					<div
						class="flex min-w-0 items-center gap-1.5"
						:style="projectColorStyle({ name: selectedWorktree.name, path: selectedWorktree.colorKey })"
					>
						<span
							class="grid h-4 w-4 shrink-0 place-items-center rounded bg-[var(--project-color)] text-[10px] font-bold text-[var(--project-fg)]"
						>
							{{ projectInitial(selectedWorktree.name) }}
						</span>
						<SelectValue class="truncate text-left">
							<span class="truncate">{{ selectedWorktree.name }}</span>
						</SelectValue>
						<Badge v-if="selectedWorktree.isPrimary" variant="secondary">main</Badge>
						<Badge v-if="selectedWorktree.branch" variant="secondary">{{ selectedWorktree.branch }}</Badge>
						<Badge variant="outline">{{ selectedWorktree.cardCount }} cards</Badge>
					</div>

					<SelectIcon class="ml-auto shrink-0 text-muted-foreground">
						<ChevronDown class="h-4 w-4" />
					</SelectIcon>
				</SelectTrigger>

				<SelectPortal>
					<SelectContent
						position="popper"
						:side-offset="6"
						class="z-50 max-h-72 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-md border border-border/70 bg-popover text-popover-foreground shadow-xl outline-none"
					>
						<SelectViewport class="p-1">
							<SelectItem
								v-for="worktree in worktrees"
								:key="worktree.id"
								:value="worktree.id"
								class="relative flex min-h-9 cursor-default select-none items-center rounded py-2 pl-7 pr-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
							>
								<span class="absolute left-2 grid h-4 w-4 place-items-center">
									<SelectItemIndicator>
										<Check class="h-4 w-4 text-primary" />
									</SelectItemIndicator>
								</span>
								<div class="flex min-w-0 items-center gap-2">
									<span
										class="grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] font-bold"
										:style="projectColorStyle({ name: worktree.name, path: worktree.colorKey })"
									>
										<span
											class="grid h-4 w-4 place-items-center rounded bg-[var(--project-color)] text-[var(--project-fg)]"
										>
											{{ projectInitial(worktree.name) }}
										</span>
									</span>
									<div class="min-w-0">
										<SelectItemText class="block truncate font-medium">
											{{ worktree.name }}
										</SelectItemText>
									</div>
									<Badge v-if="worktree.isPrimary" variant="secondary">main</Badge>
									<Badge v-if="worktree.branch" variant="secondary">{{ worktree.branch }}</Badge>
									<Badge variant="outline">{{ worktree.cardCount }} cards</Badge>
								</div>
							</SelectItem>
						</SelectViewport>
					</SelectContent>
				</SelectPortal>
			</SelectRoot>
		</div>
	</div>
</template>
