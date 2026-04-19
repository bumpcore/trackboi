<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Keyboard, ListPlus, Monitor, Moon, RotateCcw, Search, Sun, Trash2, UserRoundCog, Wrench, X } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import { shortcutFromKeyboardEvent } from "@/ui/lib/keyboardShortcuts";
import type { AgentRegistration } from "@/core/types";
import type { ThemeMode } from "@/ui/composables/useAppPreferences";

const props = defineProps<{
	open: boolean;
	paths: string[];
	busy: boolean;
	agents: AgentRegistration[];
	detectedEditors: Array<{ id: string; label: string; command: string }>;
}>();

const draft = defineModel<string>("draft", { required: true });
const leftPanelShortcut = defineModel<string>("leftPanelShortcut", { required: true });
const rightPanelShortcut = defineModel<string>("rightPanelShortcut", { required: true });
const themeMode = defineModel<ThemeMode>("themeMode", { required: true });
const preferredEditorId = defineModel<string>("preferredEditorId", { required: true });
const customEditorCommand = defineModel<string>("customEditorCommand", { required: true });
const agentNameDraft = defineModel<string>("agentNameDraft", { required: true });
const agentDescriptionDraft = defineModel<string>("agentDescriptionDraft", { required: true });

const emit = defineEmits<{
	close: [];
	add: [];
	remove: [path: string];
	reset: [];
	resetShortcuts: [];
	resetTheme: [];
	registerAgent: [];
	removeAgent: [agentId: string];
	saveEditor: [];
}>();

type SettingsSection = "storage" | "appearance" | "shortcuts" | "agents" | "editor";

const activeSection = ref<SettingsSection>("storage");
const captureArmed = ref<"left" | "right" | null>(null);

watch(
	() => props.open,
	(open) => {
		if (open) {
			activeSection.value = "storage";
			captureArmed.value = null;
		}
	},
);

const themeOptions: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
	{ value: "dark", label: "Dark", description: "Keep the cockpit-style dark workspace.", icon: Moon },
	{ value: "light", label: "Light", description: "Use a brighter canvas with the same warm accent direction.", icon: Sun },
	{ value: "system", label: "System", description: "Follow the desktop color-scheme preference automatically.", icon: Monitor },
];

const editorOptions = computed(() => [
	{ id: "auto", label: "Auto detect", description: "Pick the first detected editor, then fall back to the OS default." },
	...props.detectedEditors.map((editor) => ({
		id: editor.id,
		label: editor.label,
		description: editor.command,
	})),
	{ id: "custom", label: "Custom command", description: "Run your own shell command, using {path} as the file placeholder." },
]);

function captureShortcut(side: "left" | "right", event: KeyboardEvent) {
	event.preventDefault();
	event.stopPropagation();

	if (event.key === "Escape") {
		captureArmed.value = null;
		(event.currentTarget as HTMLElement | null)?.blur();
		return;
	}

	const shortcut = shortcutFromKeyboardEvent(event);
	if (!shortcut) return;

	if (side === "left") leftPanelShortcut.value = shortcut;
	else rightPanelShortcut.value = shortcut;

	captureArmed.value = null;
	(event.currentTarget as HTMLElement | null)?.blur();
}
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-x-0 bottom-0 top-9 z-30 grid place-items-center bg-background/65 p-5 backdrop-blur-[2px]"
			@pointerdown.self="emit('close')"
		>
			<aside
				class="modal-panel grid h-[min(760px,calc(100vh-72px))] w-[min(860px,96vw)] grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
			>
				<div class="grid content-start border-r border-border/35 bg-background/32 p-4">
					<div class="grid gap-6">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-primary">Trackboi</p>
							<h2 class="mt-1 text-lg font-semibold tracking-tight">App settings</h2>
						</div>

						<div class="grid gap-4">
							<div>
								<p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Storage</p>
								<button
									type="button"
									class="mt-2 flex w-full items-center gap-2 rounded-md bg-card/55 px-3 py-2 text-left text-sm font-medium text-foreground"
									@click="activeSection = 'storage'"
								>
									<Search class="h-4 w-4 text-muted-foreground" />
									Storage lookup
								</button>
							</div>

							<div>
								<p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
								<button
									type="button"
									class="mt-2 flex w-full items-center gap-2 rounded-md bg-card/55 px-3 py-2 text-left text-sm font-medium text-foreground"
									@click="activeSection = 'appearance'"
								>
									<Sun class="h-4 w-4 text-muted-foreground" />
									Theme
								</button>
							</div>

							<div>
								<p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Workspace</p>
								<button
									type="button"
									class="mt-2 flex w-full items-center gap-2 rounded-md bg-card/55 px-3 py-2 text-left text-sm font-medium text-foreground"
									@click="activeSection = 'shortcuts'"
								>
									<Keyboard class="h-4 w-4 text-muted-foreground" />
									Panel shortcuts
								</button>
							</div>

							<div>
								<p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actors</p>
								<button
									type="button"
									class="mt-2 flex w-full items-center gap-2 rounded-md bg-card/55 px-3 py-2 text-left text-sm font-medium text-foreground"
									@click="activeSection = 'agents'"
								>
									<UserRoundCog class="h-4 w-4 text-muted-foreground" />
									Agents
								</button>
							</div>

							<div>
								<p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Editor</p>
								<button
									type="button"
									class="mt-2 flex w-full items-center gap-2 rounded-md bg-card/55 px-3 py-2 text-left text-sm font-medium text-foreground"
									@click="activeSection = 'editor'"
								>
									<Wrench class="h-4 w-4 text-muted-foreground" />
									Open in editor
								</button>
							</div>
						</div>
					</div>
				</div>

				<div class="app-scroll grid content-start gap-6 overflow-y-auto p-6">
					<header class="flex items-start justify-between gap-3 border-b border-border/30 pb-5">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-primary">General</p>
							<h2 class="mt-1 text-xl font-semibold tracking-tight">
								{{
									activeSection === "storage"
										? "Storage lookup"
										: activeSection === "appearance"
											? "Theme"
											: activeSection === "shortcuts"
												? "Panel shortcuts"
												: activeSection === "agents"
													? "Agents"
													: "Open in editor"
								}}
							</h2>
							<p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
								{{
									activeSection === "storage"
										? "Trackboi searches these repo-relative locations in order and opens the first store it finds."
										: activeSection === "appearance"
											? "Choose how Trackboi paints the desktop shell and code surfaces."
											: activeSection === "shortcuts"
												? "Configure the global shortcuts that collapse or reopen the desktop side panels."
												: activeSection === "agents"
													? "Manage globally registered agents used by MCP mutations."
													: "Choose how card files open in an external editor."
								}}
							</p>
						</div>
						<Button variant="ghost" size="icon" type="button" @click="emit('close')">
							<X class="h-4 w-4" />
						</Button>
					</header>

					<section v-if="activeSection === 'storage'" class="grid gap-4">
						<section class="grid gap-1 overflow-hidden rounded-lg bg-background/12">
							<div class="border-b border-border/60 px-4 py-3">
								<h3 class="text-sm font-semibold text-foreground">Search order</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Earlier paths win. If a repo contains more than one Trackboi store, the first matching path becomes the active database.
								</p>
							</div>

							<div class="grid gap-0">
								<div
									v-for="(path, index) in paths"
									:key="path"
									class="flex items-center justify-between gap-3 border-b border-border/35 px-4 py-3 last:border-b-0"
								>
									<div class="min-w-0">
										<p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
											{{ index + 1 }} priority
										</p>
										<p class="mt-1 truncate font-mono text-sm text-foreground">{{ path }}</p>
									</div>
									<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="emit('remove', path)">
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>
						</section>

						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Add location</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Use repo-relative paths only. Keep them narrow and predictable so Trackboi stays easy to reason about.
								</p>
							</div>

							<form class="grid gap-3" @submit.prevent="emit('add')">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Storage path
									<Input v-model="draft" autocomplete="off" placeholder=".etc/.trackboi" />
								</label>
								<div class="flex flex-wrap gap-2">
									<Button type="submit" :disabled="busy || !draft.trim()">
										<ListPlus class="h-4 w-4" />
										Add path
									</Button>
									<Button variant="outline" type="button" :disabled="busy" @click="emit('reset')">
										<RotateCcw class="h-4 w-4" />
										Restore defaults
									</Button>
								</div>
							</form>
						</section>
					</section>

					<section v-else-if="activeSection === 'appearance'" class="grid gap-4">
						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Theme mode</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Switch between the dark workspace, a lighter drafting surface, or your system preference.
								</p>
							</div>

							<div class="grid gap-2">
								<button
									v-for="option in themeOptions"
									:key="option.value"
									type="button"
									class="flex items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors"
									:class="themeMode === option.value
										? 'border-primary/35 bg-primary/10 text-foreground'
										: 'border-border/70 bg-secondary/55 text-foreground hover:border-border/90 hover:bg-secondary/78'"
									@click="themeMode = option.value"
								>
									<component :is="option.icon" class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
									<div class="min-w-0">
										<div class="trackboi-mono-font text-[12px] text-foreground">{{ option.label }}</div>
										<p class="mt-1 text-sm leading-6 text-muted-foreground">{{ option.description }}</p>
									</div>
								</button>
							</div>

							<div class="flex flex-wrap gap-2">
								<Button variant="outline" type="button" @click="emit('resetTheme')">
									<RotateCcw class="h-4 w-4" />
									Restore default
								</Button>
							</div>
						</section>
					</section>

					<section v-else-if="activeSection === 'shortcuts'" class="grid gap-4">
						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Panel toggle shortcuts</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Focus a shortcut field and press the new key combination. Shortcuts stay global, but they do not fire while you are typing inside inputs or editors.
								</p>
							</div>

							<div class="grid gap-4">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Left panel
									<button
										type="button"
										class="trackboi-mono-font flex h-8 w-full items-center rounded-[5px] border border-input/82 bg-secondary/72 px-2.5 py-1 text-left text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-colors hover:bg-secondary/88 focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										@click="captureArmed = 'left'"
										@focus="captureArmed = 'left'"
										@blur="captureArmed = null"
										@keydown="captureShortcut('left', $event)"
									>
										{{ captureArmed === 'left' ? "Press shortcut" : leftPanelShortcut }}
									</button>
								</label>

								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Right panel
									<button
										type="button"
										class="trackboi-mono-font flex h-8 w-full items-center rounded-[5px] border border-input/82 bg-secondary/72 px-2.5 py-1 text-left text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-colors hover:bg-secondary/88 focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										@click="captureArmed = 'right'"
										@focus="captureArmed = 'right'"
										@blur="captureArmed = null"
										@keydown="captureShortcut('right', $event)"
									>
										{{ captureArmed === 'right' ? "Press shortcut" : rightPanelShortcut }}
									</button>
								</label>
							</div>

							<div class="flex flex-wrap gap-2">
								<Button variant="outline" type="button" @click="emit('resetShortcuts')">
									<RotateCcw class="h-4 w-4" />
									Restore defaults
								</Button>
							</div>
						</section>
					</section>

					<section v-else-if="activeSection === 'agents'" class="grid gap-4">
						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Registered agents</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									MCP mutations are attributed to the active registered agent instead of a freeform model label.
								</p>
							</div>

							<div v-if="agents.length > 0" class="grid gap-2">
								<div
									v-for="agent in agents"
									:key="agent.id"
									class="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-secondary/55 px-3 py-3"
								>
									<div class="min-w-0">
										<div class="trackboi-mono-font text-[12px] text-foreground">{{ agent.name }}</div>
										<p class="mt-1 text-sm text-muted-foreground">{{ agent.description }}</p>
									</div>
									<Button variant="outline" type="button" @click="emit('removeAgent', agent.id)">
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>

							<form class="grid gap-3" @submit.prevent="emit('registerAgent')">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Agent name
									<Input v-model="agentNameDraft" autocomplete="off" placeholder="Claude Code" />
								</label>
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Description
									<Input v-model="agentDescriptionDraft" autocomplete="off" placeholder="Primary coding agent on this machine" />
								</label>
								<div>
									<Button type="submit" :disabled="!agentNameDraft.trim()">
										<ListPlus class="h-4 w-4" />
										Register agent
									</Button>
								</div>
							</form>
						</section>
					</section>

					<section v-else-if="activeSection === 'editor'" class="grid gap-4">
						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Preferred editor</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Use auto-detect, pick a detected editor, or provide a custom shell command. Use <span class="trackboi-mono-font">{path}</span> as the file placeholder.
								</p>
							</div>

							<div class="grid gap-2">
								<button
									v-for="option in editorOptions"
									:key="option.id"
									type="button"
									class="flex items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors"
									:class="preferredEditorId === option.id
										? 'border-primary/35 bg-primary/10 text-foreground'
										: 'border-border/70 bg-secondary/55 text-foreground hover:border-border/90 hover:bg-secondary/78'"
									@click="preferredEditorId = option.id"
								>
									<div class="min-w-0">
										<div class="trackboi-mono-font text-[12px] text-foreground">{{ option.label }}</div>
										<p class="mt-1 text-sm leading-6 text-muted-foreground">{{ option.description }}</p>
									</div>
								</button>
							</div>

							<label v-if="preferredEditorId === 'custom'" class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Custom command
								<Input v-model="customEditorCommand" autocomplete="off" placeholder='cursor "{path}"' />
							</label>

							<div>
								<Button type="button" @click="emit('saveEditor')">
									Save editor
								</Button>
							</div>
						</section>
					</section>
				</div>
			</aside>
		</div>
	</Transition>
</template>
