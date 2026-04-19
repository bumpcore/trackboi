<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import { X } from "lucide-vue-next";
import type { PersonAlias, ProjectSnapshot } from "@/core/types";
import Button from "@/ui/components/Button.vue";
import ProjectSettingsPanel from "@/ui/components/ProjectSettingsPanel.vue";

const props = defineProps<{
	open: boolean;
	busy: boolean;
	snapshot: ProjectSnapshot | null;
	people: PersonAlias[];
}>();

const personDisplayNameDraft = defineModel<string>("personDisplayNameDraft", { required: true });
const personEmailsDraft = defineModel<string>("personEmailsDraft", { required: true });
const personNamesDraft = defineModel<string>("personNamesDraft", { required: true });

const emit = defineEmits<{
	close: [];
	addPersonAlias: [];
	removePersonAlias: [personId: string];
}>();

function handleEscapeKey(event: KeyboardEvent) {
	if (!props.open || event.key !== "Escape") return;
	emit("close");
}

watch(
	() => props.open,
	(open) => {
		if (open) window.addEventListener("keydown", handleEscapeKey);
		else window.removeEventListener("keydown", handleEscapeKey);
	},
	{ immediate: true },
);

onBeforeUnmount(() => {
	window.removeEventListener("keydown", handleEscapeKey);
});
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-x-0 bottom-0 top-9 z-30 grid place-items-center bg-background/65 p-5 backdrop-blur-[2px]"
			data-testid="project-settings-modal"
			@pointerdown.self="emit('close')"
		>
			<aside class="modal-panel grid h-[min(820px,calc(100vh-72px))] w-[min(980px,96vw)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
				<header class="flex items-start justify-between gap-3 border-b border-border/30 px-6 py-5">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-primary">Project</p>
						<h2 class="mt-1 text-xl font-semibold tracking-tight text-foreground">Project settings</h2>
						<p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							Manage project-scoped people aliases and shared configuration for the active worktree project.
						</p>
					</div>
					<Button variant="ghost" size="icon" type="button" @click="emit('close')">
						<X class="h-4 w-4" />
					</Button>
				</header>

				<div class="app-scroll min-h-0 overflow-y-auto p-6">
					<ProjectSettingsPanel
						v-model:person-display-name-draft="personDisplayNameDraft"
						v-model:person-emails-draft="personEmailsDraft"
						v-model:person-names-draft="personNamesDraft"
						:snapshot="snapshot"
						:people="people"
						:busy="busy"
						@add-person-alias="emit('addPersonAlias')"
						@remove-person-alias="emit('removePersonAlias', $event)"
					/>
				</div>
			</aside>
		</div>
	</Transition>
</template>
