<script setup lang="ts">
import { ListPlus, SlidersHorizontal, Trash2 } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import type { PersonAlias, ProjectSnapshot } from "@/core/types";

defineProps<{
	snapshot: ProjectSnapshot | null;
	people: PersonAlias[];
	busy: boolean;
}>();

const personDisplayNameDraft = defineModel<string>("personDisplayNameDraft", { required: true });
const personEmailsDraft = defineModel<string>("personEmailsDraft", { required: true });
const personNamesDraft = defineModel<string>("personNamesDraft", { required: true });

const emit = defineEmits<{
	addPersonAlias: [];
	removePersonAlias: [personId: string];
}>();
</script>

<template>
	<div v-if="snapshot" class="grid content-start gap-5">
		<section class="shell-section">
			<div class="flex items-start gap-3">
				<div class="grid h-9 w-9 place-items-center rounded-md border border-border/80 bg-secondary/55 text-muted-foreground">
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
					class="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-secondary/55 px-3 py-3"
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
					<Button variant="outline" type="button" :disabled="busy" @click="emit('removePersonAlias', person.id)">
						<Trash2 class="h-4 w-4" />
					</Button>
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
						<ListPlus class="h-4 w-4" />
						Add person
					</Button>
				</div>
			</form>
		</section>
	</div>
</template>
