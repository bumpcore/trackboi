<script setup lang="ts">
import { computed } from "vue";
import { HelpCircle, Plus, Settings } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { ProjectEntry, ProjectView } from "@/core/types";
import { projectColorStyle } from "@/ui/lib/projectColor";

const props = defineProps<{
	view: ProjectView;
	busy: boolean;
}>();

const emit = defineEmits<{
	settings: [];
	chooseProject: [];
	switchProject: [projectPath: string];
}>();

function projectInitial(name: string) {
	return name.slice(0, 1).toUpperCase();
}

function projectTooltip(entry: ProjectEntry, sourceLabel: string) {
	const branch = entry.branch ? `, ${entry.branch}` : "";
	const count = entry.cardCount == null ? "" : `, ${entry.cardCount} cards`;
	return `${entry.name}${branch}${count} - ${sourceLabel}`;
}

const manualSource = computed(() => props.view.sources.find((source) => source.kind === "manual") ?? null);
</script>

<template>
	<aside class="flex min-h-0 flex-col items-center border-r border-border/60 bg-card/70 py-4">
		<div class="grid h-8 w-8 place-items-center rounded-md bg-primary/90 text-xs font-black text-primary-foreground">
			tb
		</div>

		<div class="mt-5 grid gap-2.5">
			<Tooltip
				v-for="entry in manualSource?.entries ?? []"
				:key="entry.projectPath"
				:content="projectTooltip(entry, manualSource?.label ?? 'Projects')"
				side="right"
			>
					<button
						class="relative grid h-8 w-8 place-items-center rounded-md border text-sm font-semibold transition"
						:class="entry.projectPath === view.activeProjectPath
							? 'border-[var(--project-color)] bg-[var(--project-color)] text-[var(--project-fg)] shadow-[0_0_0_1px_hsl(var(--background)),0_0_0_2px_var(--project-color)]'
							: 'border-border/60 bg-background/40 text-muted-foreground hover:border-muted-foreground/70 hover:text-foreground'"
						:style="projectColorStyle(entry)"
						type="button"
						@click="emit('switchProject', entry.projectPath)"
					>
						{{ projectInitial(entry.name) }}
					</button>
			</Tooltip>

			<Tooltip content="Add project" side="right">
				<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="emit('chooseProject')">
					<Plus class="h-4 w-4" />
				</Button>
			</Tooltip>
		</div>

		<div class="mt-auto grid gap-2.5">
			<Tooltip content="Settings" side="right">
				<Button variant="ghost" size="icon" type="button" @click="emit('settings')">
					<Settings class="h-4 w-4" />
				</Button>
			</Tooltip>
			<Tooltip content="Help" side="right">
				<Button variant="ghost" size="icon" type="button">
					<HelpCircle class="h-4 w-4" />
				</Button>
			</Tooltip>
		</div>
	</aside>
</template>
