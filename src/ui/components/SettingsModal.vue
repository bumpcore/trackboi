<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Bot, Code2, HardDrive, Keyboard, ListPlus, Monitor, Moon, Palette, RotateCcw, Sun, Trash2, X } from "lucide-vue-next";
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
const commandCenterNavigateShortcut = defineModel<string>("commandCenterNavigateShortcut", { required: true });
const commandCenterCommandShortcut = defineModel<string>("commandCenterCommandShortcut", { required: true });
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
const captureArmed = ref<"left" | "right" | "navigate" | "command" | null>(null);

watch(
	() => props.open,
	(open) => {
		if (open) {
			activeSection.value = "storage";
			captureArmed.value = null;
		}
	},
);

const sectionMeta: Record<SettingsSection, { group: string; title: string; description: string }> = {
	storage:    { group: "App",       title: "Storage paths",      description: "Trackboi checks these paths in order and opens the first store it finds. Earlier entries take priority over later ones." },
	appearance: { group: "App",       title: "Appearance",         description: "Control how Trackboi looks across the desktop shell and editing surfaces." },
	shortcuts:  { group: "Workspace", title: "Keyboard shortcuts", description: "Bind key combinations for the command center and side panels. Shortcuts won't fire while you're typing inside an input or editor." },
	agents:     { group: "Workspace", title: "Agents",             description: "Agents registered here are attributed as the actor on card changes made through the MCP interface." },
	editor:     { group: "Workspace", title: "Code editor",        description: "Choose which editor Trackboi launches when you open a card's source file." },
};

const themeOptions: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
	{ value: "dark",   label: "Dark",   description: "The default cockpit-style dark workspace.",                     icon: Moon    },
	{ value: "light",  label: "Light",  description: "A brighter canvas with the same warm accent direction.",        icon: Sun     },
	{ value: "system", label: "System", description: "Follows your desktop color-scheme preference automatically.",   icon: Monitor },
];

const editorOptions = computed(() => [
	{ id: "auto",   label: "Auto-detect",     description: "Use the first detected editor, falling back to the OS default." },
	...props.detectedEditors.map((editor) => ({
		id: editor.id,
		label: editor.label,
		description: editor.command,
	})),
	{ id: "custom", label: "Custom command",  description: "Provide your own shell command. Use {path} as the file placeholder." },
]);

function captureShortcut(target: "left" | "right" | "navigate" | "command", event: KeyboardEvent) {
	event.preventDefault();
	event.stopPropagation();

	if (event.key === "Escape") {
		captureArmed.value = null;
		(event.currentTarget as HTMLElement | null)?.blur();
		return;
	}

	const shortcut = shortcutFromKeyboardEvent(event);
	if (!shortcut) return;

	if (target === "left") leftPanelShortcut.value = shortcut;
	else if (target === "right") rightPanelShortcut.value = shortcut;
	else if (target === "navigate") commandCenterNavigateShortcut.value = shortcut;
	else commandCenterCommandShortcut.value = shortcut;

	captureArmed.value = null;
	(event.currentTarget as HTMLElement | null)?.blur();
}

function handleEscapeKey(event: KeyboardEvent) {
	if (!props.open || event.key !== "Escape" || captureArmed.value) return;
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
			data-testid="app-settings-modal"
			@pointerdown.self="emit('close')"
		>
			<aside
				class="modal-panel grid h-[min(760px,calc(100vh-72px))] w-[min(860px,96vw)] grid-cols-[200px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
			>
				<!-- Sidebar -->
				<div class="grid content-start gap-6 border-r border-border/35 bg-background/32 p-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-primary">Trackboi</p>
						<h2 class="mt-1 text-lg font-semibold tracking-tight">Settings</h2>
					</div>

					<nav class="grid gap-4">
						<div>
							<p class="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55">App</p>
							<div class="grid gap-0.5">
								<button
									type="button"
									class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'storage'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'storage'"
								>
									<HardDrive class="h-4 w-4 shrink-0" />
									Storage
								</button>
								<button
									type="button"
									class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'appearance'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'appearance'"
								>
									<Palette class="h-4 w-4 shrink-0" />
									Appearance
								</button>
							</div>
						</div>

						<div>
							<p class="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55">Workspace</p>
							<div class="grid gap-0.5">
								<button
									type="button"
									class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'shortcuts'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'shortcuts'"
								>
									<Keyboard class="h-4 w-4 shrink-0" />
									Shortcuts
								</button>
								<button
									type="button"
									class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'agents'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'agents'"
								>
									<Bot class="h-4 w-4 shrink-0" />
									Agents
								</button>
								<button
									type="button"
									class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'editor'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'editor'"
								>
									<Code2 class="h-4 w-4 shrink-0" />
									Editor
								</button>
							</div>
						</div>
					</nav>
				</div>

				<!-- Main content -->
				<div class="app-scroll grid content-start gap-6 overflow-y-auto p-6">
					<header class="flex items-start justify-between gap-3 border-b border-border/30 pb-5">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-primary">{{ sectionMeta[activeSection].group }}</p>
							<h2 class="mt-1 text-xl font-semibold tracking-tight">{{ sectionMeta[activeSection].title }}</h2>
							<p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{{ sectionMeta[activeSection].description }}</p>
						</div>
						<Button variant="ghost" size="icon" type="button" @click="emit('close')">
							<X class="h-4 w-4" />
						</Button>
					</header>

					<!-- Storage -->
					<section v-if="activeSection === 'storage'" class="grid gap-4">
						<section class="grid gap-0 overflow-hidden rounded-lg bg-background/12">
							<div class="border-b border-border/60 px-4 py-3">
								<h3 class="text-sm font-semibold text-foreground">Path priority</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									The first path that resolves to a valid store becomes active. Drag to reorder, or remove paths you don't need.
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
											{{ index === 0 ? "Highest priority" : `Priority ${index + 1}` }}
										</p>
										<p class="mt-1 truncate font-mono text-sm text-foreground">{{ path }}</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										type="button"
										:disabled="busy"
										class="text-muted-foreground hover:text-destructive"
										@click="emit('remove', path)"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>
						</section>

						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Add a path</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Repo-relative paths only. The new path is appended at the lowest priority.
								</p>
							</div>

							<form class="grid gap-3" @submit.prevent="emit('add')">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Path
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

					<!-- Appearance -->
					<section v-else-if="activeSection === 'appearance'" class="grid gap-4">
						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Color theme</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Pick a theme or let the desktop decide. The change takes effect immediately.
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

							<div>
								<Button variant="outline" type="button" @click="emit('resetTheme')">
									<RotateCcw class="h-4 w-4" />
									Restore default
								</Button>
							</div>
						</section>
					</section>

					<!-- Shortcuts -->
					<section v-else-if="activeSection === 'shortcuts'" class="grid gap-4">
						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Command center</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Use one shortcut for quick navigation and another for explicit command mode. Typing <span class="trackboi-mono-font">&gt;</span> also switches to commands inside the launcher.
								</p>
							</div>

							<div class="grid gap-4">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Navigate
									<button
										type="button"
										class="trackboi-mono-font flex h-8 w-full items-center rounded-[5px] border border-input/82 bg-secondary/72 px-2.5 py-1 text-left text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-colors hover:bg-secondary/88 focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										:class="captureArmed === 'navigate' ? 'border-primary/35 ring-1 ring-ring' : ''"
										@click="captureArmed = 'navigate'"
										@focus="captureArmed = 'navigate'"
										@blur="captureArmed = null"
										@keydown="captureShortcut('navigate', $event)"
									>
										{{ captureArmed === "navigate" ? "Listening for shortcut…" : commandCenterNavigateShortcut }}
									</button>
								</label>

								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Command mode
									<button
										type="button"
										class="trackboi-mono-font flex h-8 w-full items-center rounded-[5px] border border-input/82 bg-secondary/72 px-2.5 py-1 text-left text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-colors hover:bg-secondary/88 focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										:class="captureArmed === 'command' ? 'border-primary/35 ring-1 ring-ring' : ''"
										@click="captureArmed = 'command'"
										@focus="captureArmed = 'command'"
										@blur="captureArmed = null"
										@keydown="captureShortcut('command', $event)"
									>
										{{ captureArmed === "command" ? "Listening for shortcut…" : commandCenterCommandShortcut }}
									</button>
								</label>
							</div>
						</section>

						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Panel toggles</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Click a field and press the key combination you want to assign. Press Escape to cancel.
								</p>
							</div>

							<div class="grid gap-4">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Left panel
									<button
										type="button"
										class="trackboi-mono-font flex h-8 w-full items-center rounded-[5px] border border-input/82 bg-secondary/72 px-2.5 py-1 text-left text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-colors hover:bg-secondary/88 focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										:class="captureArmed === 'left' ? 'border-primary/35 ring-1 ring-ring' : ''"
										@click="captureArmed = 'left'"
										@focus="captureArmed = 'left'"
										@blur="captureArmed = null"
										@keydown="captureShortcut('left', $event)"
									>
										{{ captureArmed === "left" ? "Listening for shortcut…" : leftPanelShortcut }}
									</button>
								</label>

								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Right panel
									<button
										type="button"
										class="trackboi-mono-font flex h-8 w-full items-center rounded-[5px] border border-input/82 bg-secondary/72 px-2.5 py-1 text-left text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-colors hover:bg-secondary/88 focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										:class="captureArmed === 'right' ? 'border-primary/35 ring-1 ring-ring' : ''"
										@click="captureArmed = 'right'"
										@focus="captureArmed = 'right'"
										@blur="captureArmed = null"
										@keydown="captureShortcut('right', $event)"
									>
										{{ captureArmed === "right" ? "Listening for shortcut…" : rightPanelShortcut }}
									</button>
								</label>
							</div>

							<div>
								<Button variant="outline" type="button" @click="emit('resetShortcuts')">
									<RotateCcw class="h-4 w-4" />
									Restore defaults
								</Button>
							</div>
						</section>
					</section>

					<!-- Agents -->
					<section v-else-if="activeSection === 'agents'" class="grid gap-4">
						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Registered agents</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Each registered agent gets a stable identity. Card mutations from MCP are attributed to the matching agent rather than a raw model name.
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
									<Button
										variant="ghost"
										size="icon"
										type="button"
										class="text-muted-foreground hover:text-destructive"
										@click="emit('removeAgent', agent.id)"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>

							<div v-else class="rounded-md border border-dashed border-border/75 bg-background/20 px-4 py-4 text-sm text-muted-foreground">
								No agents registered yet.
							</div>

							<form class="grid gap-3" @submit.prevent="emit('registerAgent')">
								<div class="grid gap-3 sm:grid-cols-2">
									<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
										Name
										<Input v-model="agentNameDraft" autocomplete="off" placeholder="Claude Code" />
									</label>
									<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
										Description
										<Input v-model="agentDescriptionDraft" autocomplete="off" placeholder="Primary coding agent" />
									</label>
								</div>
								<div>
									<Button type="submit" :disabled="!agentNameDraft.trim()" @click="emit('registerAgent')">
										<ListPlus class="h-4 w-4" />
										Register agent
									</Button>
								</div>
							</form>
						</section>
					</section>

					<!-- Editor -->
					<section v-else-if="activeSection === 'editor'" class="grid gap-4">
						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Preferred editor</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Select from detected editors or provide a custom command. Use <span class="trackboi-mono-font">{path}</span> where the file path should go.
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
								Command
								<Input v-model="customEditorCommand" autocomplete="off" placeholder='cursor "{path}"' />
							</label>

							<div>
								<Button type="button" @click="emit('saveEditor')">
									Save
								</Button>
							</div>
						</section>
					</section>
				</div>
			</aside>
		</div>
	</Transition>
</template>
