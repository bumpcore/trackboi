<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Bot, Code2, HardDrive, Info, Keyboard, Monitor, Moon, Palette, SlidersHorizontal, Sun, Trash2, User, X } from "lucide-vue-next";
import packageJson from "../../../package.json";
import type { AgentRegistration, PersonAlias, ProjectSnapshot } from "@/core/types";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import ProjectSettingsPanel from "@/ui/components/ProjectSettingsPanel.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import { ACCENT_COLOR_OPTIONS } from "@/ui/composables/useThemeMode";
import { shortcutFromKeyboardEvent } from "@/ui/lib/keyboardShortcuts";
import type { AccentColor, ThemeMode } from "@/ui/composables/useAppPreferences";
import type { SettingsSection } from "@/ui/viewTypes";

const props = defineProps<{
	open: boolean;
	paths: string[];
	busy: boolean;
	agents: AgentRegistration[];
	snapshot: ProjectSnapshot | null;
	people: PersonAlias[];
	detectedEditors: Array<{ id: string; label: string; command: string }>;
	canRemoveProject: boolean;
}>();

const activeSection = defineModel<SettingsSection>("section", { required: true });
const draft = defineModel<string>("draft", { required: true });
const leftPanelShortcut = defineModel<string>("leftPanelShortcut", { required: true });
const rightPanelShortcut = defineModel<string>("rightPanelShortcut", { required: true });
const commandCenterNavigateShortcut = defineModel<string>("commandCenterNavigateShortcut", { required: true });
const commandCenterCommandShortcut = defineModel<string>("commandCenterCommandShortcut", { required: true });
const openSettingsShortcut = defineModel<string>("openSettingsShortcut", { required: true });
const addProjectShortcut = defineModel<string>("addProjectShortcut", { required: true });
const newCardShortcut = defineModel<string>("newCardShortcut", { required: true });
const newTrackShortcut = defineModel<string>("newTrackShortcut", { required: true });
const nextProjectShortcut = defineModel<string>("nextProjectShortcut", { required: true });
const previousProjectShortcut = defineModel<string>("previousProjectShortcut", { required: true });
const projectSettingsShortcut = defineModel<string>("projectSettingsShortcut", { required: true });
const boardSettingsShortcut = defineModel<string>("boardSettingsShortcut", { required: true });
const focusBoardShortcut = defineModel<string>("focusBoardShortcut", { required: true });
const themeMode = defineModel<ThemeMode>("themeMode", { required: true });
const accentColor = defineModel<AccentColor>("accentColor", { required: true });
const preferredEditorId = defineModel<string>("preferredEditorId", { required: true });
const customEditorCommand = defineModel<string>("customEditorCommand", { required: true });
const userDisplayName = defineModel<string>("userDisplayName", { required: true });
const userGitName = defineModel<string>("userGitName", { required: true });
const userGitEmail = defineModel<string>("userGitEmail", { required: true });
const agentNameDraft = defineModel<string>("agentNameDraft", { required: true });
const agentDescriptionDraft = defineModel<string>("agentDescriptionDraft", { required: true });
const personDisplayNameDraft = defineModel<string>("personDisplayNameDraft", { required: true });
const personEmailsDraft = defineModel<string>("personEmailsDraft", { required: true });
const personNamesDraft = defineModel<string>("personNamesDraft", { required: true });
const projectColorDraft = defineModel<string>("projectColorDraft", { required: true });
const projectIconPathDraft = defineModel<string>("projectIconPathDraft", { required: true });

const emit = defineEmits<{
	close: [];
	add: [];
	remove: [path: string];
	reset: [];
	resetShortcuts: [];
	resetTheme: [];
	resetAccent: [];
	saveUserIdentity: [];
	registerAgent: [];
	removeAgent: [agentId: string];
	saveEditor: [];
	addPersonAlias: [];
	removePersonAlias: [personId: string];
	saveProjectColor: [];
	chooseProjectIcon: [];
	saveProjectIcon: [];
	removeProject: [];
}>();
type ShortcutTarget =
	| "left"
	| "right"
	| "navigate"
	| "command"
	| "settings"
	| "addProject"
	| "newCard"
	| "newTrack"
	| "nextProject"
	| "previousProject"
	| "projectSettings"
	| "boardSettings"
	| "focusBoard";

const captureArmed = ref<ShortcutTarget | null>(null);
const versionLabel = computed(() => import.meta.env.DEV ? "dev" : `v${packageJson.version}`);

watch(
	() => props.open,
	(open) => {
		if (open) {
			captureArmed.value = null;
		}
	},
);

const sectionMeta: Record<SettingsSection, { group: string; title: string; description: string }> = {
	storage:    { group: "App",       title: "Storage paths",      description: "trackboi checks these paths in order and opens the first store it finds. Earlier entries take priority over later ones." },
	general:    { group: "App",       title: "General",            description: "Set the local identity trackboi should use for people aliases, onboarding, and agent handoff defaults." },
	appearance: { group: "App",       title: "Appearance",         description: "Control how trackboi looks across the desktop shell and editing surfaces." },
	shortcuts:  { group: "Workspace", title: "Keyboard shortcuts", description: "Bind key combinations for the command center and side panels. Shortcuts won't fire while you're typing inside an input or editor." },
	agents:     { group: "Workspace", title: "Agent identity",     description: "Choose the stable handle trackboi should stamp on agent-made work, regardless of which harness or model is driving it." },
	editor:     { group: "Workspace", title: "Code editor",        description: "Choose which editor trackboi launches when you open a card's source file." },
	project:    { group: "Current project", title: "Project settings", description: "Manage people aliases and project-scoped configuration for the active worktree project." },
	about:      { group: "App",       title: "About",              description: "Version, storage, release, and project information for this trackboi build." },
};

const shortcutRows = computed<Array<{ target: ShortcutTarget; label: string; model: string }>>(() => [
	{ target: "navigate", label: "Command center: navigate", model: commandCenterNavigateShortcut.value },
	{ target: "command", label: "Command center: command mode", model: commandCenterCommandShortcut.value },
	{ target: "settings", label: "Open settings", model: openSettingsShortcut.value },
	{ target: "addProject", label: "Add project", model: addProjectShortcut.value },
	{ target: "newCard", label: "New card", model: newCardShortcut.value },
	{ target: "newTrack", label: "New track", model: newTrackShortcut.value },
	{ target: "left", label: "Toggle left panel", model: leftPanelShortcut.value },
	{ target: "right", label: "Toggle right panel", model: rightPanelShortcut.value },
	{ target: "nextProject", label: "Next project", model: nextProjectShortcut.value },
	{ target: "previousProject", label: "Previous project", model: previousProjectShortcut.value },
	{ target: "projectSettings", label: "Project settings", model: projectSettingsShortcut.value },
	{ target: "boardSettings", label: "Board settings", model: boardSettingsShortcut.value },
	{ target: "focusBoard", label: "Focus board", model: focusBoardShortcut.value },
]);

const themeOptions: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
	{ value: "dark",   label: "Dark",   description: "The default cockpit-style dark workspace.",                     icon: Moon    },
	{ value: "light",  label: "Light",  description: "A brighter canvas with the same warm accent direction.",        icon: Sun     },
	{ value: "system", label: "System", description: "Follows your desktop color-scheme preference automatically.",   icon: Monitor },
];

const accentOptions = ACCENT_COLOR_OPTIONS;

const editorOptions = computed(() => [
	{ id: "auto",   label: "Auto-detect",     description: "Use the first detected editor, falling back to the OS default." },
	...props.detectedEditors.map((editor) => ({
		id: editor.id,
		label: editor.label,
		description: editor.command,
	})),
	{ id: "custom", label: "Custom command",  description: "Provide your own shell command. Use {path} as the file placeholder." },
]);

function captureShortcut(target: ShortcutTarget, event: KeyboardEvent) {
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
	else if (target === "command") commandCenterCommandShortcut.value = shortcut;
	else if (target === "settings") openSettingsShortcut.value = shortcut;
	else if (target === "addProject") addProjectShortcut.value = shortcut;
	else if (target === "newCard") newCardShortcut.value = shortcut;
	else if (target === "newTrack") newTrackShortcut.value = shortcut;
	else if (target === "nextProject") nextProjectShortcut.value = shortcut;
	else if (target === "previousProject") previousProjectShortcut.value = shortcut;
	else if (target === "projectSettings") projectSettingsShortcut.value = shortcut;
	else if (target === "boardSettings") boardSettingsShortcut.value = shortcut;
	else focusBoardShortcut.value = shortcut;

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
				class="modal-panel grid h-[min(760px,calc(100vh-72px))] w-[min(860px,96vw)] grid-cols-[200px_minmax(0,1fr)] overflow-hidden border border-border/60 bg-card shadow-2xl"
			>
				<!-- Sidebar -->
				<div class="grid content-start gap-6 border-r border-border/35 bg-background/32 p-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-primary">trackboi</p>
						<h2 class="mt-1 text-lg font-semibold tracking-tight">Settings</h2>
					</div>

					<nav class="grid gap-4">
						<div>
							<p class="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55">App</p>
							<div class="grid gap-0.5">
								<button
									type="button"
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'general'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'general'"
								>
									<User class="h-4 w-4 shrink-0" />
									General
								</button>
								<button
									type="button"
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
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
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'appearance'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'appearance'"
								>
									<Palette class="h-4 w-4 shrink-0" />
									Appearance
								</button>
								<button
									type="button"
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'about'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'about'"
								>
									<Info class="h-4 w-4 shrink-0" />
									About
								</button>
							</div>
						</div>

						<div>
							<p class="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55">Workspace</p>
							<div class="grid gap-0.5">
								<button
									type="button"
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
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
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'agents'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'agents'"
								>
									<Bot class="h-4 w-4 shrink-0" />
									My agent
								</button>
								<button
									type="button"
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'editor'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'editor'"
								>
									<Code2 class="h-4 w-4 shrink-0" />
									Editor
								</button>
								<button
									v-if="snapshot"
									type="button"
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
									:class="activeSection === 'project'
										? 'bg-secondary/80 font-medium text-foreground'
										: 'font-normal text-muted-foreground hover:bg-secondary/45 hover:text-foreground'"
									@click="activeSection = 'project'"
								>
									<SlidersHorizontal class="h-4 w-4 shrink-0" />
									Current project
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
						<Tooltip content="Close" side="left">
							<Button variant="ghost" size="icon" type="button" class="rounded-[2px]" aria-label="Close" @click="emit('close')">
								<X class="h-4 w-4" />
							</Button>
						</Tooltip>
					</header>

					<!-- General -->
					<section v-if="activeSection === 'general'" class="grid gap-4">
						<section class="grid gap-4 bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Your identity</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Used to seed project people aliases and make local handoffs readable.
								</p>
							</div>

							<div class="grid gap-3 sm:grid-cols-2">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Display name
									<Input v-model="userDisplayName" autocomplete="off" placeholder="Abdulkadir" />
								</label>
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Git name
									<Input v-model="userGitName" autocomplete="off" placeholder="git config user.name" />
								</label>
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
									Git email
									<Input v-model="userGitEmail" autocomplete="off" placeholder="git config user.email" />
								</label>
							</div>

							<div>
								<Button type="button" class="rounded-none" :disabled="!userDisplayName.trim()" @click="emit('saveUserIdentity')">
									Save
								</Button>
							</div>
						</section>
					</section>

					<!-- Storage -->
					<section v-else-if="activeSection === 'storage'" class="grid gap-4">
						<section class="grid gap-0 overflow-hidden bg-background/12">
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
									<Tooltip content="Remove path" side="left">
										<Button
											variant="ghost"
											size="icon"
											type="button"
											aria-label="Remove path"
											:disabled="busy"
											class="rounded-none text-muted-foreground hover:text-destructive"
											@click="emit('remove', path)"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</Tooltip>
								</div>
							</div>
						</section>

						<section class="grid gap-4 bg-background/12 p-4">
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
									<Button type="submit" class="rounded-none" :disabled="busy || !draft.trim()">
										Add
									</Button>
									<Button variant="outline" type="button" class="rounded-none" :disabled="busy" @click="emit('reset')">
										Reset
									</Button>
								</div>
							</form>
						</section>
					</section>

					<!-- Appearance -->
					<section v-else-if="activeSection === 'appearance'" class="grid gap-4">
						<section class="grid gap-4 bg-background/12 p-4">
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
									class="flex items-start gap-3 border px-3 py-3 text-left transition-colors"
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
								<Button variant="outline" type="button" class="rounded-none" @click="emit('resetTheme')">
									Reset
								</Button>
							</div>
						</section>

						<section class="grid gap-4 bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Accent color</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Choose the highlight color used by selected states, focus rings, and primary actions.
								</p>
							</div>

							<div class="grid gap-2 sm:grid-cols-2">
								<button
									v-for="option in accentOptions"
									:key="option.value"
									type="button"
									class="flex items-center gap-3 border px-3 py-3 text-left transition-colors"
									:class="accentColor === option.value
										? 'border-primary/45 bg-primary/10 text-foreground'
										: 'border-border/70 bg-secondary/55 text-foreground hover:border-border/90 hover:bg-secondary/78'"
									@click="accentColor = option.value"
								>
									<span
										class="h-5 w-5 shrink-0 rounded-[2px] border border-border/70"
										:style="{ backgroundColor: `hsl(var(--accent-preview-${option.value}))` }"
									/>
									<span class="trackboi-mono-font text-[12px] text-foreground">{{ option.label }}</span>
								</button>
							</div>

							<div>
								<Button variant="outline" type="button" class="rounded-none" @click="emit('resetAccent')">
									Reset
								</Button>
							</div>
						</section>
					</section>

					<!-- Shortcuts -->
					<section v-else-if="activeSection === 'shortcuts'" class="grid gap-4">
						<section class="grid gap-4 bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Power shortcuts</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Click a field and press the key combination you want. Press Escape to cancel.
								</p>
							</div>

							<div class="grid gap-3">
								<label
									v-for="row in shortcutRows"
									:key="row.target"
									class="grid gap-1.5 text-xs font-medium text-muted-foreground"
								>
									{{ row.label }}
									<button
										type="button"
										class="trackboi-mono-font flex h-8 w-full items-center border border-input/82 bg-secondary/72 px-2.5 py-1 text-left text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] transition-colors hover:bg-secondary/88 focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										:class="captureArmed === row.target ? 'border-primary/35 ring-1 ring-ring' : ''"
										@click="captureArmed = row.target"
										@focus="captureArmed = row.target"
										@blur="captureArmed = null"
										@keydown="captureShortcut(row.target, $event)"
									>
										{{ captureArmed === row.target ? "Listening for shortcut…" : row.model }}
									</button>
								</label>
							</div>

							<div>
								<Button variant="outline" type="button" class="rounded-none" @click="emit('resetShortcuts')">
									Reset
								</Button>
							</div>
						</section>
					</section>

					<!-- Agent identity -->
					<section v-else-if="activeSection === 'agents'" class="grid gap-4">
						<section class="grid gap-4 bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Saved identities</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									This is the name of your agent in trackboi. When it touches a project, trackboi records the identity in that project's metadata so future changes still read as the same actor.
								</p>
							</div>

							<div v-if="agents.length > 0" class="grid gap-2">
								<div
									v-for="agent in agents"
									:key="agent.id"
									class="flex items-center justify-between gap-3 border border-border/70 bg-secondary/55 px-3 py-3"
								>
									<div class="min-w-0">
										<div class="trackboi-mono-font text-[12px] text-foreground">{{ agent.name }}</div>
										<p class="mt-1 text-sm text-muted-foreground">{{ agent.description }}</p>
									</div>
									<Tooltip content="Remove identity" side="left">
										<Button
											variant="ghost"
											size="icon"
											type="button"
											aria-label="Remove identity"
											class="rounded-none text-muted-foreground hover:text-destructive"
											@click="emit('removeAgent', agent.id)"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</Tooltip>
								</div>
							</div>

							<div v-else class="border border-dashed border-border/75 bg-background/20 px-4 py-4 text-sm text-muted-foreground">
								No agent identity saved yet.
							</div>

							<form class="grid gap-3" @submit.prevent="emit('registerAgent')">
								<div class="grid gap-3 sm:grid-cols-2">
									<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
										Handle
										<Input v-model="agentNameDraft" autocomplete="off" placeholder="boi" />
									</label>
									<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
										Note
										<Input v-model="agentDescriptionDraft" autocomplete="off" placeholder="Default coding identity" />
									</label>
								</div>
								<div>
									<Button type="submit" class="rounded-none" :disabled="!agentNameDraft.trim()">
										Save
									</Button>
								</div>
							</form>
						</section>
					</section>

					<!-- Editor -->
					<section v-else-if="activeSection === 'editor'" class="grid gap-4">
						<section class="grid gap-4 bg-background/12 p-4">
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
									class="flex items-start gap-3 border px-3 py-3 text-left transition-colors"
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
								<Button type="button" class="rounded-none" @click="emit('saveEditor')">
									Save
								</Button>
							</div>
						</section>
					</section>

					<!-- Project -->
					<section v-else-if="activeSection === 'project'" class="grid gap-4">
						<section v-if="snapshot" class="grid gap-4 bg-background/12 p-4">
							<ProjectSettingsPanel
								v-model:person-display-name-draft="personDisplayNameDraft"
								v-model:person-emails-draft="personEmailsDraft"
								v-model:person-names-draft="personNamesDraft"
								v-model:project-color-draft="projectColorDraft"
								v-model:project-icon-path-draft="projectIconPathDraft"
								:snapshot="snapshot"
								:people="people"
								:busy="busy"
								:can-remove-project="canRemoveProject"
								@add-person-alias="emit('addPersonAlias')"
								@remove-person-alias="emit('removePersonAlias', $event)"
								@save-project-color="emit('saveProjectColor')"
								@choose-project-icon="emit('chooseProjectIcon')"
								@save-project-icon="emit('saveProjectIcon')"
								@remove-project="emit('removeProject')"
							/>
						</section>
						<section v-else class="grid gap-4 bg-background/12 p-4">
							<div class="border border-dashed border-border/75 bg-background/20 px-4 py-4 text-sm text-muted-foreground">
								Open a project first to configure project-scoped settings.
							</div>
						</section>
					</section>

					<!-- About -->
					<section v-else-if="activeSection === 'about'" class="grid gap-4">
						<section class="grid gap-4 bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">trackboi {{ versionLabel }}</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									No bullshit kanban for agents and people. 100% local and git based.
								</p>
							</div>
							<div class="grid gap-2 text-sm">
								<div class="flex justify-between gap-4 border-b border-border/35 py-2">
									<span class="text-muted-foreground">App settings</span>
									<span class="trackboi-mono-font text-right text-foreground">~/.trackboi/config.json</span>
								</div>
								<div class="flex justify-between gap-4 border-b border-border/35 py-2">
									<span class="text-muted-foreground">Repo store default</span>
									<span class="trackboi-mono-font text-right text-foreground">.trackboi</span>
								</div>
								<div class="flex justify-between gap-4 border-b border-border/35 py-2">
									<span class="text-muted-foreground">License</span>
									<span class="trackboi-mono-font text-right text-foreground">MIT</span>
								</div>
								<div class="flex justify-between gap-4 py-2">
									<span class="text-muted-foreground">Repository</span>
									<span class="trackboi-mono-font text-right text-foreground">github.com/bumpcore/trackboi</span>
								</div>
							</div>
						</section>
					</section>
				</div>
			</aside>
		</div>
	</Transition>
</template>
