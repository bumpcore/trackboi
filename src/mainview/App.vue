<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
	AlertTriangle,
	FolderOpen,
	GitBranch,
	HelpCircle,
	ListPlus,
	Maximize2,
	Minus,
	PanelLeft,
	Plus,
	RefreshCw,
	Save,
	Settings,
	Trash2,
	X,
} from "lucide-vue-next";
import BoardColumn from "./components/BoardColumn.vue";
import { desktop } from "./lib/desktop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UiCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
	Card as TrackboiCard,
	ProjectIndex,
	ProjectIndexEntry,
	ProjectSnapshot,
	WindowFrame,
} from "../shared/types";

const snapshot = ref<ProjectSnapshot | null>(null);
const registry = ref<ProjectIndex>({ projects: [], activeProjectId: null, storageSearchPaths: [] });
const loading = ref(true);
const busy = ref(false);
const error = ref<string | null>(null);
const settingsOpen = ref(false);
const draftTitle = ref("");
const draftDescription = ref("");
const draftColumn = ref("todo");
const storagePathDraft = ref("");
const editingCard = ref<TrackboiCard | null>(null);
const editDraft = reactive({
	title: "",
	description: "",
});

type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
type BoardScopeMode = "all" | "branch" | "global";

const MIN_WINDOW_WIDTH = 760;
const MIN_WINDOW_HEIGHT = 480;
const boardScopeMode = ref<BoardScopeMode>("all");

const gitBranchLabel = computed(() => {
	if (!snapshot.value?.git.isGitRepo) return null;
	return snapshot.value.git.branch ?? (snapshot.value.git.detached ? "detached" : "git");
});
const scopedCards = computed(() => {
	const cards = snapshot.value?.cards ?? [];
	const branch = snapshot.value?.git.branch ?? null;

	if (boardScopeMode.value === "branch" && branch) {
		return cards.filter((card) => card.scope.kind === "branch" && card.scope.ref === branch);
	}

	if (boardScopeMode.value === "global") {
		return cards.filter((card) => card.scope.kind === "project");
	}

	return cards;
});

const cardsByColumn = computed(() => {
	const grouped = new Map<string, TrackboiCard[]>();
	for (const column of snapshot.value?.board.columns ?? []) {
		grouped.set(column.id, []);
	}
	for (const card of scopedCards.value) {
		grouped.get(card.column)?.push(card);
	}
	return grouped;
});

const activeProject = computed(() => (
	registry.value.projects.find((project) => project.id === registry.value.activeProjectId) ?? null
));
const activeProjectInitial = computed(() => (
	(activeProject.value?.name ?? snapshot.value?.project.name ?? "Trackboi").slice(0, 1).toUpperCase()
));
const activeProjectPath = computed(() => activeProject.value?.path ?? snapshot.value?.project.path ?? "Choose a project");
const activeStoragePath = computed(() => activeProject.value?.storagePath ?? snapshot.value?.project.storagePath ?? ".trackboi");
const visibleProjects = computed(() => {
	const seenPaths = new Set<string>();
	return registry.value.projects.filter((project) => {
		if (seenPaths.has(project.path)) return false;
		seenPaths.add(project.path);
		return true;
	});
});
const hasProjects = computed(() => registry.value.projects.length > 0);
const totalCards = computed(() => snapshot.value?.cards.length ?? 0);
const visibleCardCount = computed(() => scopedCards.value.length);

function projectInitial(name: string) {
	return name.slice(0, 1).toUpperCase();
}

function statusLabel(status: ProjectIndexEntry["status"]) {
	if (status === "ready") return "Ready";
	if (status === "uninitialized") return "New";
	return "Missing";
}

function statusClass(status: ProjectIndexEntry["status"]) {
	if (status === "ready") return "bg-primary";
	if (status === "uninitialized") return "bg-amber-400";
	return "bg-destructive";
}

function setError(errorValue: unknown) {
	error.value = errorValue instanceof Error ? errorValue.message : String(errorValue);
}

function setSnapshot(nextSnapshot: ProjectSnapshot | null) {
	snapshot.value = nextSnapshot;
	draftColumn.value = nextSnapshot?.board.columns[0]?.id ?? "todo";
}

async function refreshRegistry() {
	registry.value = await desktop.listProjectIndex();
}

async function run(action: () => Promise<void>) {
	error.value = null;
	busy.value = true;
	try {
		await action();
	} catch (caught) {
		setError(caught);
	} finally {
		busy.value = false;
	}
}

async function loadProject() {
	loading.value = true;
	error.value = null;
	try {
		await refreshRegistry();
		setSnapshot(await desktop.getActiveProject());
		await refreshRegistry();
	} catch (caught) {
		setError(caught);
	} finally {
		loading.value = false;
	}
}

async function chooseProject() {
	await run(async () => {
		setSnapshot(await desktop.chooseProject());
		await refreshRegistry();
	});
}

async function locateProject(projectId: string) {
	await run(async () => {
		setSnapshot(await desktop.locateProject(projectId));
		await refreshRegistry();
	});
}

async function removeProject(projectId: string) {
	const project = registry.value.projects.find((project) => project.id === projectId);
	if (!project) return;
	if (!window.confirm(`Remove "${project.name}" from Trackboi? Files on disk will stay where they are.`)) return;

	await run(async () => {
		setSnapshot(await desktop.removeProject(projectId));
		await refreshRegistry();
	});
}

async function addStorageSearchPath() {
	const path = storagePathDraft.value.trim();
	if (!path) return;

	await run(async () => {
		registry.value = await desktop.setStorageSearchPaths([...registry.value.storageSearchPaths, path]);
		storagePathDraft.value = "";
	});
}

async function removeStorageSearchPath(path: string) {
	if (registry.value.storageSearchPaths.length <= 1) {
		setError("Trackboi needs at least one storage search path");
		return;
	}

	await run(async () => {
		registry.value = await desktop.setStorageSearchPaths(
			registry.value.storageSearchPaths.filter((candidate) => candidate !== path),
		);
	});
}

async function resetStorageSearchPaths() {
	await run(async () => {
		registry.value = await desktop.setStorageSearchPaths([".etc/.trackboi", ".etc/trackboi", ".trackboi"]);
	});
}

async function switchProject(projectId: string) {
	if (projectId === registry.value.activeProjectId) return;

	await run(async () => {
		setSnapshot(await desktop.switchProject(projectId));
		await refreshRegistry();
	});
}

async function createNewCard() {
	const title = draftTitle.value.trim();
	if (!title) return;

	await run(async () => {
		await desktop.createCard({
			title,
			description: draftDescription.value,
			column: draftColumn.value,
		});
		draftTitle.value = "";
		draftDescription.value = "";
	});
}

function startEditing(card: TrackboiCard) {
	editingCard.value = card;
	editDraft.title = card.title;
	editDraft.description = card.description;
}

async function saveEditingCard() {
	if (!editingCard.value) return;
	const cardId = editingCard.value.id;

	await run(async () => {
		await desktop.updateCard(cardId, {
			title: editDraft.title,
			description: editDraft.description,
		});
		editingCard.value = null;
	});
}

async function deleteExistingCard(card: TrackboiCard) {
	if (!window.confirm(`Delete "${card.title}"?`)) return;

	await run(async () => {
		await desktop.deleteCard(card.id);
		if (editingCard.value?.id === card.id) {
			editingCard.value = null;
		}
	});
}

async function moveCard(cardId: string, toColumn: string, beforeCardId: string | null) {
	await run(async () => {
		await desktop.moveCard(cardId, toColumn, beforeCardId);
	});
}

async function minimizeWindow() {
	await desktop.minimizeWindow();
}

async function toggleMaximizeWindow() {
	await desktop.toggleMaximizeWindow();
}

async function closeWindow() {
	await desktop.closeWindow();
}

function isWindowControlEvent(event: Event) {
	const target = event.target;
	return target instanceof HTMLElement && target.closest("[data-window-control]") != null;
}

function startTitlebarDrag(event: PointerEvent) {
	if (event.button !== 0 || event.detail > 1 || isWindowControlEvent(event)) return;
	event.preventDefault();
	void desktop.startWindowDrag();
}

async function handleTitlebarDoubleClick(event: MouseEvent) {
	if (isWindowControlEvent(event)) return;
	await toggleMaximizeWindow();
}

function resizeCursor(edge: ResizeEdge) {
	if (edge === "n" || edge === "s") return "ns-resize";
	if (edge === "e" || edge === "w") return "ew-resize";
	if (edge === "ne" || edge === "sw") return "nesw-resize";
	return "nwse-resize";
}

function resizeHandleClass(edge: ResizeEdge) {
	const base = "electrobun-webkit-app-region-no-drag fixed z-50";
	const classes: Record<ResizeEdge, string> = {
		n: "left-3 right-3 top-0 h-2",
		e: "right-0 top-3 bottom-3 w-2",
		s: "left-3 right-3 bottom-0 h-2",
		w: "left-0 top-3 bottom-3 w-2",
		ne: "right-0 top-0 h-4 w-4",
		nw: "left-0 top-0 h-4 w-4",
		se: "right-0 bottom-0 h-4 w-4",
		sw: "left-0 bottom-0 h-4 w-4",
	};

	return `${base} ${classes[edge]}`;
}

function nextFrameForResize(
	edge: ResizeEdge,
	startFrame: WindowFrame,
	deltaX: number,
	deltaY: number,
): WindowFrame {
	let { x, y, width, height } = startFrame;

	if (edge.includes("e")) {
		width = Math.max(MIN_WINDOW_WIDTH, startFrame.width + deltaX);
	}

	if (edge.includes("s")) {
		height = Math.max(MIN_WINDOW_HEIGHT, startFrame.height + deltaY);
	}

	if (edge.includes("w")) {
		const nextWidth = Math.max(MIN_WINDOW_WIDTH, startFrame.width - deltaX);
		x = startFrame.x + (startFrame.width - nextWidth);
		width = nextWidth;
	}

	if (edge.includes("n")) {
		const nextHeight = Math.max(MIN_WINDOW_HEIGHT, startFrame.height - deltaY);
		y = startFrame.y + (startFrame.height - nextHeight);
		height = nextHeight;
	}

	return { x, y, width, height };
}

async function startResize(edge: ResizeEdge, event: PointerEvent) {
	event.preventDefault();

	if (desktop.isTauri) {
		await desktop.startResize(edge);
		return;
	}

	const target = event.currentTarget as HTMLElement | null;
	target?.setPointerCapture(event.pointerId);

	const startX = event.screenX;
	const startY = event.screenY;
	const startFrame = await desktop.getWindowFrame();
	let pending = false;
	let latestFrame = startFrame;

	const move = (moveEvent: PointerEvent) => {
		latestFrame = nextFrameForResize(
			edge,
			startFrame,
			moveEvent.screenX - startX,
			moveEvent.screenY - startY,
		);

		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			void desktop.setWindowFrame(latestFrame);
		});
	};

	const stop = () => {
		target?.releasePointerCapture(event.pointerId);
		window.removeEventListener("pointermove", move);
		window.removeEventListener("pointerup", stop);
		window.removeEventListener("pointercancel", stop);
	};

	window.addEventListener("pointermove", move);
	window.addEventListener("pointerup", stop, { once: true });
	window.addEventListener("pointercancel", stop, { once: true });
}

desktop.addBoardChangedListener(setSnapshot);

onMounted(loadProject);
</script>

<template>
	<div class="grid h-screen grid-rows-[36px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
		<div
			v-for="edge in (['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[])"
			:key="edge"
			:class="resizeHandleClass(edge)"
			:style="{ cursor: resizeCursor(edge) }"
			@pointerdown="startResize(edge, $event)"
		/>

		<header
			class="electrobun-webkit-app-region-drag grid h-9 grid-cols-[58px_260px_minmax(0,1fr)_112px] border-b border-border/80 bg-card/95 max-lg:grid-cols-[58px_minmax(0,1fr)_112px]"
		>
			<div class="border-r border-border/80" data-tauri-drag-region @pointerdown="startTitlebarDrag" />
			<div
				class="flex items-center gap-2 border-r border-border/80 px-3 max-lg:hidden"
				data-tauri-drag-region
				@pointerdown="startTitlebarDrag"
			>
				<PanelLeft class="h-3.5 w-3.5 text-muted-foreground" />
				<span class="text-xs font-medium text-muted-foreground">Projects</span>
			</div>
			<div
				class="flex items-center justify-between px-4"
				@dblclick="handleTitlebarDoubleClick"
				@pointerdown="startTitlebarDrag"
			>
				<div class="min-w-0">
					<span class="block truncate text-xs font-semibold text-foreground">
						{{ snapshot?.project.name ?? "Trackboi" }}
					</span>
				</div>
				<div class="electrobun-webkit-app-region-no-drag flex items-center gap-2" data-window-control>
					<Badge v-if="snapshot" variant="secondary">{{ totalCards }} cards</Badge>
					<Badge v-if="gitBranchLabel" variant="outline" class="max-w-48 gap-1.5">
						<GitBranch class="h-3 w-3 shrink-0" />
						<span class="truncate">{{ gitBranchLabel }}</span>
					</Badge>
					<Badge variant="outline">{{ activeStoragePath }}</Badge>
				</div>
			</div>
			<div class="electrobun-webkit-app-region-no-drag flex items-center justify-end border-l border-border/80 px-1" data-window-control>
				<Button variant="ghost" size="icon" type="button" title="Minimize" @click="minimizeWindow">
					<Minus class="h-4 w-4" />
				</Button>
				<Button variant="ghost" size="icon" type="button" title="Maximize" @click="toggleMaximizeWindow">
					<Maximize2 class="h-3.5 w-3.5" />
				</Button>
				<Button variant="ghost" size="icon" type="button" title="Close" @click="closeWindow">
					<X class="h-4 w-4" />
				</Button>
			</div>
		</header>

		<main class="grid h-full min-h-0 grid-cols-[58px_260px_minmax(0,1fr)] items-stretch overflow-hidden max-lg:grid-cols-[58px_minmax(0,1fr)]">
			<aside class="flex min-h-0 flex-col items-center border-r border-border/80 bg-card/90 py-4">
				<div class="grid h-8 w-8 place-items-center rounded-md bg-primary text-xs font-black text-primary-foreground">
					tb
				</div>

				<div class="mt-5 grid gap-3">
					<button
						v-for="project in visibleProjects"
						:key="project.id"
						class="relative grid h-9 w-9 place-items-center rounded-md border text-sm font-semibold transition"
						:class="project.id === registry.activeProjectId
							? 'border-foreground bg-secondary text-foreground'
							: 'border-border bg-background text-muted-foreground hover:border-muted-foreground hover:text-foreground'"
						type="button"
						:title="`${project.name} - ${statusLabel(project.status)}`"
						@click="switchProject(project.id)"
					>
						{{ projectInitial(project.name) }}
						<span
							class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-background"
							:class="statusClass(project.status)"
						/>
					</button>

					<Button variant="ghost" size="icon" type="button" :disabled="busy" title="Add project" @click="chooseProject">
						<Plus class="h-4 w-4" />
					</Button>
				</div>

				<div class="mt-auto grid gap-3">
					<Button variant="ghost" size="icon" type="button" title="Settings" @click="settingsOpen = true">
						<Settings class="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" type="button" title="Help">
						<HelpCircle class="h-4 w-4" />
					</Button>
				</div>
			</aside>

			<aside class="min-h-0 overflow-hidden border-r border-border/80 bg-card/60 px-5 py-5 max-lg:hidden">
				<div class="flex items-start gap-3">
					<div class="grid h-10 w-10 place-items-center rounded-md border border-border bg-secondary text-sm font-semibold">
						{{ activeProjectInitial }}
					</div>
					<div class="min-w-0">
						<h1 class="truncate text-base font-semibold tracking-tight">
							{{ activeProject?.name ?? "Trackboi" }}
						</h1>
						<p class="truncate text-xs text-muted-foreground">
							{{ activeProjectPath }}
						</p>
						<p v-if="activeProject" class="mt-1 truncate text-xs text-muted-foreground">
							{{ activeStoragePath }}
						</p>
					</div>
				</div>

				<div v-if="activeProject" class="mt-4 flex items-center gap-2">
					<Badge variant="secondary" class="gap-1.5">
						<span class="h-1.5 w-1.5 rounded-full" :class="statusClass(activeProject.status)" />
						{{ statusLabel(activeProject.status) }}
					</Badge>
					<Badge v-if="snapshot" variant="outline">{{ totalCards }} cards</Badge>
				</div>

				<div v-if="gitBranchLabel" class="mt-2">
					<Badge variant="outline" class="max-w-full gap-1.5">
						<GitBranch class="h-3 w-3 shrink-0" />
						<span class="truncate">{{ gitBranchLabel }}</span>
					</Badge>
				</div>

				<Button class="mt-6 w-full" variant="outline" type="button" :disabled="busy" @click="chooseProject">
					<FolderOpen class="h-4 w-4" />
					Add project
				</Button>

				<div v-if="activeProject" class="mt-2 grid grid-cols-2 gap-2">
					<Button variant="outline" size="sm" type="button" :disabled="busy" @click="locateProject(activeProject.id)">
						<RefreshCw class="h-3.5 w-3.5" />
						Locate
					</Button>
					<Button variant="outline" size="sm" type="button" :disabled="busy" @click="removeProject(activeProject.id)">
						<Trash2 class="h-3.5 w-3.5" />
						Remove
					</Button>
				</div>

				<UiCard v-if="snapshot" class="mt-5 p-4">
					<form class="grid gap-3" @submit.prevent="createNewCard">
						<span class="text-xs font-semibold uppercase text-primary">New card</span>
						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Title
							<Input v-model="draftTitle" autocomplete="off" placeholder="Ship the first slice" />
						</label>
						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Notes
							<Textarea v-model="draftDescription" rows="4" placeholder="Small enough to move today." />
						</label>
						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Column
							<Select v-model="draftColumn">
								<option
									v-for="column in snapshot.board.columns"
									:key="column.id"
									:value="column.id"
								>
									{{ column.name }}
								</option>
							</Select>
						</label>
						<Button class="w-full" type="submit" :disabled="busy || !draftTitle.trim()">
							<Plus class="h-4 w-4" />
							Add card
						</Button>
					</form>
				</UiCard>
			</aside>

			<section class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden px-6 py-5">
				<header class="mb-5 flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase text-primary">Board</p>
						<h2 class="mt-1 text-2xl font-semibold tracking-tight">
							{{ snapshot?.board.name ?? "No project selected" }}
						</h2>
					</div>
					<div v-if="snapshot" class="flex items-center gap-2">
						<Badge variant="secondary">{{ visibleCardCount }} shown</Badge>
						<Select v-model="boardScopeMode" class="w-40">
							<option value="all">All cards</option>
							<option value="branch" :disabled="!snapshot.git.branch">Current branch</option>
							<option value="global">Global</option>
						</Select>
					</div>
				</header>

				<div class="min-h-0 min-w-0 overflow-auto">
					<UiCard v-if="error" class="mb-4 border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive-foreground">
						{{ error }}
					</UiCard>

					<UiCard v-if="loading" class="mt-20 grid max-w-md gap-2 border-dashed p-8">
						<h2 class="text-xl font-semibold">Loading board</h2>
						<p class="text-sm text-muted-foreground">Looking for the nearest repo.</p>
					</UiCard>

					<UiCard v-else-if="activeProject?.status === 'missing'" class="mt-20 grid max-w-xl gap-4 border-dashed p-8">
						<div class="flex items-start gap-3">
							<div class="grid h-10 w-10 place-items-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive">
								<AlertTriangle class="h-5 w-5" />
							</div>
							<div class="min-w-0">
								<h2 class="text-xl font-semibold">Project folder is missing</h2>
								<p class="mt-2 text-sm text-muted-foreground">
									Trackboi kept the entry so you can point it at the folder again or remove it from the rail.
								</p>
								<p class="mt-3 truncate rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
									{{ activeProject.path }}
								</p>
							</div>
						</div>
						<div class="flex flex-wrap gap-2">
							<Button type="button" :disabled="busy" @click="locateProject(activeProject.id)">
								<RefreshCw class="h-4 w-4" />
								Locate folder
							</Button>
							<Button variant="outline" type="button" :disabled="busy" @click="removeProject(activeProject.id)">
								<Trash2 class="h-4 w-4" />
								Remove from Trackboi
							</Button>
						</div>
					</UiCard>

					<UiCard v-else-if="!snapshot" class="mt-20 grid max-w-md gap-4 border-dashed p-8">
						<div>
							<h2 class="text-xl font-semibold">{{ hasProjects ? "Pick a project" : "Pick a repo" }}</h2>
							<p class="mt-2 text-sm text-muted-foreground">
								Trackboi will create a `.trackboi` folder with a starter board.
							</p>
						</div>
						<Button class="w-fit" type="button" :disabled="busy" @click="chooseProject">
							<FolderOpen class="h-4 w-4" />
							Choose project
						</Button>
					</UiCard>

					<div v-else class="flex min-w-max items-start gap-4 pb-5">
						<BoardColumn
							v-for="column in snapshot.board.columns"
							:key="column.id"
							:column="column"
							:cards="cardsByColumn.get(column.id) ?? []"
							@move="moveCard"
							@edit="startEditing"
							@delete="deleteExistingCard"
						/>
					</div>
				</div>
			</section>

		<aside
			v-if="editingCard"
			class="fixed inset-y-0 right-0 z-20 grid w-[min(400px,94vw)] content-start gap-4 border-l border-border bg-card p-5 shadow-2xl"
		>
			<header class="flex items-start justify-between gap-3">
				<div>
					<p class="text-xs font-semibold uppercase text-primary">Edit card</p>
					<h2 class="mt-1 text-lg font-semibold">Card details</h2>
				</div>
				<Button variant="ghost" size="icon" type="button" @click="editingCard = null">
					<X class="h-4 w-4" />
				</Button>
			</header>

			<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				Title
				<Input v-model="editDraft.title" autocomplete="off" />
			</label>

			<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				Notes
				<Textarea v-model="editDraft.description" rows="8" />
			</label>

			<div class="flex gap-2">
				<Button type="button" :disabled="busy" @click="saveEditingCard">
					<Save class="h-4 w-4" />
					Save
				</Button>
				<Button variant="outline" type="button" :disabled="busy" @click="editingCard = null">
					Cancel
				</Button>
			</div>
		</aside>

		<aside
			v-if="settingsOpen"
			class="fixed inset-y-0 right-0 z-30 grid w-[min(420px,94vw)] content-start gap-5 overflow-auto border-l border-border bg-card p-5 shadow-2xl"
		>
			<header class="flex items-start justify-between gap-3">
				<div>
					<p class="text-xs font-semibold uppercase text-primary">Settings</p>
					<h2 class="mt-1 text-lg font-semibold">Storage lookup</h2>
				</div>
				<Button variant="ghost" size="icon" type="button" @click="settingsOpen = false">
					<X class="h-4 w-4" />
				</Button>
			</header>

			<div class="grid gap-2">
				<p class="text-sm text-muted-foreground">
					Trackboi checks these repo-relative paths in order and uses the first database it finds.
				</p>
				<div class="grid gap-2">
					<div
						v-for="path in registry.storageSearchPaths"
						:key="path"
						class="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
					>
						<span class="min-w-0 truncate font-mono text-xs">{{ path }}</span>
						<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="removeStorageSearchPath(path)">
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			<form class="grid gap-2" @submit.prevent="addStorageSearchPath">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Add path
					<Input v-model="storagePathDraft" autocomplete="off" placeholder=".etc/.trackboi" />
				</label>
				<div class="flex gap-2">
					<Button type="submit" :disabled="busy || !storagePathDraft.trim()">
						<ListPlus class="h-4 w-4" />
						Add path
					</Button>
					<Button variant="outline" type="button" :disabled="busy" @click="resetStorageSearchPaths">
						Reset
					</Button>
				</div>
			</form>
		</aside>
		</main>
	</div>
</template>

<!--
	Most visual language lives in Tailwind utility classes and the local shadcn-style
	primitives under src/components/ui. Keep bespoke CSS out of this file unless the
	app needs behavior Tailwind cannot express cleanly.
-->
