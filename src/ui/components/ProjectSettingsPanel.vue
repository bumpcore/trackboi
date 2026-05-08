<script setup lang="ts">
import { Image, FolderMinus, Palette, SlidersHorizontal, Trash2 } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import ProjectIcon from "@/ui/components/ProjectIcon.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { PersonAlias, ProjectSnapshot } from "@/core/types";

defineProps<{
	snapshot: ProjectSnapshot | null;
	people: PersonAlias[];
	busy: boolean;
	canRemoveProject: boolean;
}>();

const personDisplayNameDraft = defineModel<string>("personDisplayNameDraft", { required: true });
const personEmailsDraft = defineModel<string>("personEmailsDraft", { required: true });
const personNamesDraft = defineModel<string>("personNamesDraft", { required: true });
const projectColorDraft = defineModel<string>("projectColorDraft", { required: true });
const projectIconPathDraft = defineModel<string>("projectIconPathDraft", { required: true });

const emit = defineEmits<{
	addPersonAlias: [];
	removePersonAlias: [personId: string];
	saveProjectColor: [];
	chooseProjectIcon: [];
	saveProjectIcon: [];
	removeProject: [];
}>();
</script>

<template>
	<div v-if="snapshot" class="grid content-start gap-5">
		<section class="shell-section">
			<div class="flex items-start gap-3">
				<div class="grid h-9 w-9 place-items-center rounded-[2px] border border-border/80 bg-secondary/55 text-muted-foreground">
					<Palette class="h-4 w-4" />
				</div>
				<div>
					<p class="shell-section-title">Project color</p>
					<p class="mt-1 text-sm text-muted-foreground">Choose the marker color used in project and worktree lists.</p>
				</div>
			</div>

			<form class="flex flex-wrap items-end gap-3" @submit.prevent="emit('saveProjectColor')">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Color
					<input
						v-model="projectColorDraft"
						type="color"
						class="h-8 w-16 rounded-[2px] border border-input/82 bg-secondary/72 p-1"
					>
				</label>
				<label class="grid min-w-48 flex-1 gap-1.5 text-xs font-medium text-muted-foreground">
					Value
					<Input v-model="projectColorDraft" autocomplete="off" placeholder="#3b82f6" />
				</label>
				<Button type="submit" :disabled="busy">
					Save
				</Button>
			</form>
		</section>

		<section class="shell-section">
			<div class="flex items-start gap-3">
				<ProjectIcon
					:name="snapshot.metadata.name"
					:path="snapshot.project.path"
					:color="snapshot.metadata.color"
					:icon-path="projectIconPathDraft || snapshot.metadata.iconPath"
					icon-class="h-9 w-9 text-sm"
				/>
				<div>
					<p class="shell-section-title">Project icon</p>
					<p class="mt-1 text-sm text-muted-foreground">Use a local image file as the project marker.</p>
				</div>
			</div>

			<form class="grid gap-3" @submit.prevent="emit('saveProjectIcon')">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Image path
					<Input v-model="projectIconPathDraft" autocomplete="off" placeholder="/path/to/icon.png" />
				</label>
				<div class="flex flex-wrap justify-end gap-2">
					<Button variant="outline" type="button" :disabled="busy" @click="projectIconPathDraft = ''; emit('saveProjectIcon')">
						Clear
					</Button>
					<Button variant="outline" type="button" :disabled="busy" @click="emit('chooseProjectIcon')">
						<Image class="mr-2 h-4 w-4" />
						Choose
					</Button>
					<Button type="submit" :disabled="busy">
						Save
					</Button>
				</div>
			</form>
		</section>

		<section class="shell-section">
			<div class="flex items-start gap-3">
				<div class="grid h-9 w-9 place-items-center rounded-[2px] border border-border/80 bg-secondary/55 text-muted-foreground">
					<SlidersHorizontal class="h-4 w-4" />
				</div>
				<div>
					<p class="shell-section-title">People</p>
					<p class="mt-1 text-sm text-muted-foreground">Map multiple git identities to one person so comments and edits stay human-readable.</p>
				</div>
			</div>

			<div v-if="people.length > 0" class="grid gap-2">
				<div
					v-for="person in people"
					:key="person.id"
					class="flex items-center justify-between gap-3 rounded-[2px] border border-border/80 bg-secondary/55 px-3 py-3"
				>
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-foreground">{{ person.displayName }}</p>
						<p class="mt-1 text-xs text-muted-foreground">
							{{ person.gitEmails.join(", ") || "No emails linked" }}
						</p>
						<p v-if="person.gitNames.length > 0" class="mt-1 text-xs text-muted-foreground">
							names: {{ person.gitNames.join(", ") }}
						</p>
					</div>
					<Tooltip content="Remove person" side="left">
						<Button variant="outline" size="icon" type="button" aria-label="Remove person" :disabled="busy" @click="emit('removePersonAlias', person.id)">
							<Trash2 class="h-4 w-4" />
						</Button>
					</Tooltip>
				</div>
			</div>

			<form class="grid gap-3" @submit.prevent="emit('addPersonAlias')">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Display name
					<Input v-model="personDisplayNameDraft" autocomplete="off" placeholder="Abdul Kadir" />
				</label>
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Git emails
					<Input v-model="personEmailsDraft" autocomplete="off" placeholder="work@example.com, personal@example.com" />
				</label>
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Git names
					<Input v-model="personNamesDraft" autocomplete="off" placeholder="Abdulkadir, Abdul Kadir" />
				</label>
				<div>
					<Button type="submit" :disabled="busy || !personDisplayNameDraft.trim()">
						Add person
					</Button>
				</div>
			</form>
		</section>

		<section class="shell-section border-destructive/25 bg-destructive/5">
			<div class="flex items-start gap-3">
				<div class="grid h-9 w-9 place-items-center rounded-[2px] border border-destructive/35 bg-destructive/10 text-destructive">
					<FolderMinus class="h-4 w-4" />
				</div>
				<div class="min-w-0 flex-1">
					<p class="shell-section-title">Forget project</p>
					<p class="mt-1 text-sm leading-6 text-muted-foreground">
						Remove this project from the app registry. The repository and its trackboi files stay on disk.
					</p>
					<p class="mt-2 truncate font-mono text-[11px] text-muted-foreground">{{ snapshot.project.path }}</p>
				</div>
			</div>

			<div class="flex justify-end">
				<Button
					variant="outline"
					type="button"
					class="text-destructive hover:text-destructive"
					:disabled="busy || !canRemoveProject"
					data-testid="project-remove-button"
					@click="emit('removeProject')"
				>
					Forget project
				</Button>
			</div>

			<p v-if="!canRemoveProject" class="text-xs leading-5 text-muted-foreground">
				This project is coming from workspace discovery, so it cannot be removed from the manual registry here.
			</p>
		</section>
	</div>
</template>
