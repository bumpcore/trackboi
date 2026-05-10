<script setup lang="ts">
import { computed } from "vue";
import { Bot, GitBranch, User, X } from "lucide-vue-next";
import type { AgentRegistration, PersonAlias, ProjectSnapshot } from "@/core/types";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import Tooltip from "@/ui/components/Tooltip.vue";

const props = defineProps<{
	open: boolean;
	snapshot: ProjectSnapshot | null;
	knownPeople: PersonAlias[];
	knownAgents: AgentRegistration[];
}>();

const displayName = defineModel<string>("displayName", { required: true });
const gitName = defineModel<string>("gitName", { required: true });
const gitEmail = defineModel<string>("gitEmail", { required: true });
const agentName = defineModel<string>("agentName", { required: true });
const agentDescription = defineModel<string>("agentDescription", { required: true });

const emit = defineEmits<{
	close: [];
	complete: [];
}>();

const canComplete = computed(() => displayName.value.trim().length > 0);
const storagePath = computed(() => props.snapshot?.project.storagePath ?? ".trackboi");

function usePerson(person: PersonAlias) {
	displayName.value = person.displayName;
	gitName.value = person.gitNames[0] ?? "";
	gitEmail.value = person.gitEmails[0] ?? "";
}

function useAgent(agent: AgentRegistration) {
	agentName.value = agent.name;
	agentDescription.value = agent.description ?? "";
}
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-x-0 bottom-0 top-9 z-40 grid place-items-center bg-background/72 p-5 backdrop-blur-[2px]"
			data-testid="onboarding-modal"
			@pointerdown.self="emit('close')"
		>
			<aside class="modal-panel grid w-[min(720px,96vw)] overflow-hidden border border-border/60 bg-card shadow-2xl">
				<header class="flex items-start justify-between gap-3 border-b border-border/35 px-6 py-5">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-primary">Welcome to trackboi</p>
						<h2 class="mt-1 text-xl font-semibold tracking-tight">Set up your local identity</h2>
						<p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							trackboi uses this to make repo-local cards, people aliases, and agent handoffs readable.
						</p>
					</div>
					<Tooltip content="Close" side="left">
						<Button variant="ghost" size="icon" type="button" class="rounded-[2px]" aria-label="Close" @click="emit('close')">
							<X class="h-4 w-4" />
						</Button>
					</Tooltip>
				</header>

				<div class="grid gap-5 p-6">
					<section class="grid gap-3 bg-background/12 p-4">
						<div class="flex items-start gap-3">
							<User class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div>
								<h3 class="text-sm font-semibold text-foreground">You</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">Seeded from git config when available.</p>
							</div>
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Display name
								<Input v-model="displayName" autocomplete="off" placeholder="Your name" />
							</label>
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Git name
								<Input v-model="gitName" autocomplete="off" placeholder="git config user.name" />
							</label>
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
								Git email
								<Input v-model="gitEmail" autocomplete="off" placeholder="git config user.email" />
							</label>
						</div>
						<div v-if="knownPeople.length > 0" class="flex flex-wrap gap-2">
							<Button
								v-for="person in knownPeople"
								:key="person.id"
								variant="outline"
								size="sm"
								type="button"
								@click="usePerson(person)"
							>
								{{ person.displayName }}
							</Button>
						</div>
					</section>

					<section class="grid gap-3 bg-background/12 p-4">
						<div class="flex items-start gap-3">
							<Bot class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div>
								<h3 class="text-sm font-semibold text-foreground">Default agent</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">Optional, but useful for MCP tools and future handoffs.</p>
							</div>
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Handle
								<Input v-model="agentName" autocomplete="off" placeholder="boi" />
							</label>
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Note
								<Input v-model="agentDescription" autocomplete="off" placeholder="Default coding identity" />
							</label>
						</div>
						<div v-if="knownAgents.length > 0" class="flex flex-wrap gap-2">
							<Button
								v-for="agent in knownAgents"
								:key="agent.id"
								variant="outline"
								size="sm"
								type="button"
								@click="useAgent(agent)"
							>
								{{ agent.name }}
							</Button>
						</div>
					</section>

					<section class="grid gap-3 bg-background/12 p-4">
						<div class="flex items-start gap-3">
							<GitBranch class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div>
								<h3 class="text-sm font-semibold text-foreground">Current repo</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Project data will live in <span class="trackboi-mono-font text-foreground">{{ storagePath }}</span>. Existing legacy stores are still read.
								</p>
							</div>
						</div>
					</section>

					<div class="flex flex-wrap justify-end gap-2">
						<Button variant="outline" type="button" class="rounded-[2px]" @click="emit('close')">
							Later
						</Button>
						<Button type="button" class="rounded-[2px]" :disabled="!canComplete" @click="emit('complete')">
							Finish setup
						</Button>
					</div>
				</div>
			</aside>
		</div>
	</Transition>
</template>
