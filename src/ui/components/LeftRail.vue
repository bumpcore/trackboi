<script setup lang="ts">
import { computed } from "vue";
import { Bot, CircleHelp, FolderOpen, Plus, Settings } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { ProjectEntry } from "@/core/types";
import { projectColorStyle } from "@/ui/lib/projectColor";
import type { LeftPanelView } from "@/ui/viewTypes";

const props = defineProps<{
	activeView: LeftPanelView;
	activeProjectId: string | null;
	projects: ProjectEntry[];
}>();

const emit = defineEmits<{
	select: [view: LeftPanelView];
	switchProject: [projectId: string];
	addProject: [];
	settings: [];
}>();

const items: Array<{ id: LeftPanelView; label: string; icon: typeof FolderOpen }> = [
	{ id: "explorer", label: "Explorer", icon: FolderOpen },
	{ id: "agents", label: "Agents", icon: Bot },
];

const railProjects = computed(() => props.projects.slice(0, 6));

function projectMonogram(name: string) {
	return name
		.split(/[\s.-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("") || name.slice(0, 2).toUpperCase();
}
</script>

<template>
	<aside class="border-r border-border/70 bg-card/90">
		<div class="flex h-full flex-col items-center gap-2 py-3">
			<div class="grid h-8 w-8 place-items-center rounded-md border border-border/70 bg-secondary/85 text-[11px] font-bold text-primary">
				tb
			</div>

			<div class="mt-1 flex flex-col gap-2">
				<Tooltip
					v-for="item in items"
					:key="item.id"
					:content="item.label"
					side="right"
				>
					<button
						type="button"
						class="shell-rail-button"
						:class="{ 'is-active': activeView === item.id }"
						@click="emit('select', item.id)"
					>
						<component :is="item.icon" class="h-4 w-4" />
					</button>
				</Tooltip>

				<Tooltip
					v-for="project in railProjects"
					:key="project.projectId"
					:content="project.name"
					side="right"
				>
					<button
						type="button"
						class="shell-rail-button text-[10px] font-medium"
						:class="{ 'is-active': activeProjectId === project.projectId }"
						:style="activeProjectId === project.projectId ? projectColorStyle(project) : undefined"
						@click="emit('switchProject', project.projectId)"
					>
						<span class="leading-none">{{ projectMonogram(project.name) }}</span>
					</button>
				</Tooltip>

				<Tooltip content="Add project" side="right">
					<button
						type="button"
						class="shell-rail-button"
						@click="emit('addProject')"
					>
						<Plus class="h-4 w-4" />
					</button>
				</Tooltip>
			</div>

			<div class="my-1 h-px w-5 bg-border/80" />

			<div class="mt-auto flex flex-col gap-2">
				<Tooltip content="Help" side="right">
					<Button variant="ghost" size="icon" type="button">
						<CircleHelp class="h-4 w-4" />
					</Button>
				</Tooltip>
				<Tooltip content="Global settings" side="right">
					<Button variant="ghost" size="icon" type="button" @click="emit('settings')">
						<Settings class="h-4 w-4" />
					</Button>
				</Tooltip>
			</div>
		</div>
	</aside>
</template>
