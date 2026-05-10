<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Save, Trash2 } from "lucide-vue-next";
import { newId } from "@/core/id";
import type {
	Card as TrackboiCard,
	Track,
	TrackDecision,
	TrackDecisionStatus,
	TrackPatch,
	TrackReference,
	TrackReferenceKind,
} from "@/core/types";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import MarkdownEditor from "@/ui/components/MarkdownEditor.vue";
import Select from "@/ui/components/Select.vue";
import Tooltip from "@/ui/components/Tooltip.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import { normalizeTrackDocName } from "@/ui/lib/trackDocs";

type TrackEditorTab = "track" | "brief" | "decisions" | "references" | "cards" | "new-file" | `file:${string}`;

const props = defineProps<{
	busy: boolean;
	mode: "create" | "edit";
	track: Track | null;
	linkedCards: TrackboiCard[];
	selectedFileName: string;
	selectedFileContent: string;
}>();

const emit = defineEmits<{
	save: [patch: Required<Pick<TrackPatch, "title" | "summary" | "brief" | "decisions" | "references">>];
	delete: [track: Track];
	loadFile: [fileName: string];
	writeFile: [fileName: string, content: string];
	deleteFile: [fileName: string];
	editCard: [card: TrackboiCard];
}>();

const title = ref("");
const summary = ref("");
const brief = ref("");
const decisions = ref<TrackDecision[]>([]);
const references = ref<TrackReference[]>([]);
const activeTab = ref<TrackEditorTab>("track");

const decisionDraft = reactive({
	title: "",
	body: "",
	status: "proposed" as TrackDecisionStatus,
});
const referenceDraft = reactive({
	label: "",
	value: "",
	kind: "path" as TrackReferenceKind,
});
const fileName = ref("");
const fileContent = ref("");
const editingDecisionId = ref<string | null>(null);
const editingReferenceId = ref<string | null>(null);

const baseTabs: Array<{ id: TrackEditorTab; label: string }> = [
	{ id: "track", label: "Track" },
	{ id: "brief", label: "Brief" },
	{ id: "decisions", label: "Decisions" },
	{ id: "references", label: "Refs" },
	{ id: "cards", label: "Cards" },
];
const decisionStatusOptions: SelectOption[] = [
	{ value: "proposed", label: "Proposed" },
	{ value: "accepted", label: "Accepted" },
	{ value: "rejected", label: "Rejected" },
];
const referenceKindOptions: SelectOption[] = [
	{ value: "path", label: "Repo path" },
	{ value: "card", label: "Card" },
	{ value: "branch", label: "Branch" },
	{ value: "worktree", label: "Worktree" },
	{ value: "url", label: "URL" },
];

function cloneDecisions(values: TrackDecision[]): TrackDecision[] {
	return values.map((value) => ({ ...value }));
}

function cloneReferences(values: TrackReference[]): TrackReference[] {
	return values.map((value) => ({ ...value }));
}

watch(
	() => [props.track, props.mode] as const,
	([track]) => {
		title.value = track?.title ?? "";
		summary.value = track?.summary ?? "";
		brief.value = track?.brief ?? "";
		decisions.value = cloneDecisions(track?.decisions ?? []);
		references.value = cloneReferences(track?.references ?? []);
		fileName.value = "";
		fileContent.value = "";
		activeTab.value = "track";
	},
	{ immediate: true },
);

watch(
	() => [props.selectedFileName, props.selectedFileContent] as const,
	([nextName, nextContent]) => {
		if (!nextName) return;
		fileName.value = nextName;
		fileContent.value = nextContent;
		activeTab.value = `file:${nextName}`;
	},
);

const canWriteFiles = computed(() => props.mode === "edit" && props.track != null);
const fileTabs = computed(() => props.track?.files ?? []);

function selectTab(tab: TrackEditorTab) {
	activeTab.value = tab;
	if (tab.startsWith("file:")) {
		emit("loadFile", tab.slice("file:".length));
	}
	if (tab === "new-file") {
		fileName.value = "";
		fileContent.value = "";
	}
}

function saveCurrentFile() {
	if (!canWriteFiles.value || !fileName.value.trim()) return;
	const nextName = normalizeTrackDocName(fileName.value);
	fileName.value = nextName;
	emit("writeFile", nextName, fileContent.value);
	activeTab.value = `file:${nextName}`;
}

function deleteCurrentFile() {
	if (!canWriteFiles.value || !fileName.value.trim()) return;
	emit("deleteFile", fileName.value);
	activeTab.value = "track";
}

function addDecision() {
	if (!decisionDraft.title.trim()) return;
	const timestamp = new Date().toISOString();
	decisions.value = [
		...decisions.value,
		{
			id: newId("decision"),
			title: decisionDraft.title.trim(),
			body: decisionDraft.body.trim(),
			status: decisionDraft.status,
			createdAt: timestamp,
			updatedAt: timestamp,
		},
	];
	decisionDraft.title = "";
	decisionDraft.body = "";
	decisionDraft.status = "proposed";
}

function startDecisionEdit(decision: TrackDecision) {
	editingDecisionId.value = decision.id;
	decisionDraft.title = decision.title;
	decisionDraft.body = decision.body;
	decisionDraft.status = decision.status;
}

function saveDecisionEdit() {
	if (!editingDecisionId.value || !decisionDraft.title.trim()) return;
	decisions.value = decisions.value.map((decision) => decision.id === editingDecisionId.value ? {
		...decision,
		title: decisionDraft.title.trim(),
		body: decisionDraft.body.trim(),
		status: decisionDraft.status,
		updatedAt: new Date().toISOString(),
	} : decision);
	cancelDecisionEdit();
}

function cancelDecisionEdit() {
	editingDecisionId.value = null;
	decisionDraft.title = "";
	decisionDraft.body = "";
	decisionDraft.status = "proposed";
}

function addReference() {
	if (!referenceDraft.label.trim() || !referenceDraft.value.trim()) return;
	references.value = [
		...references.value,
		{
			id: newId("reference"),
			kind: referenceDraft.kind,
			label: referenceDraft.label.trim(),
			value: referenceDraft.value.trim(),
		},
	];
	referenceDraft.label = "";
	referenceDraft.value = "";
	referenceDraft.kind = "path";
}

function startReferenceEdit(reference: TrackReference) {
	editingReferenceId.value = reference.id;
	referenceDraft.label = reference.label;
	referenceDraft.value = reference.value;
	referenceDraft.kind = reference.kind;
}

function saveReferenceEdit() {
	if (!editingReferenceId.value || !referenceDraft.label.trim() || !referenceDraft.value.trim()) return;
	references.value = references.value.map((reference) => reference.id === editingReferenceId.value ? {
		...reference,
		label: referenceDraft.label.trim(),
		value: referenceDraft.value.trim(),
		kind: referenceDraft.kind,
	} : reference);
	cancelReferenceEdit();
}

function cancelReferenceEdit() {
	editingReferenceId.value = null;
	referenceDraft.label = "";
	referenceDraft.value = "";
	referenceDraft.kind = "path";
}

function saveTrack() {
	if (!title.value.trim()) return;

	emit("save", {
		title: title.value.trim(),
		summary: summary.value,
		brief: brief.value,
		decisions: decisions.value,
		references: references.value,
	});
}

function linkedCardSubtitle(card: TrackboiCard) {
	const label = card.assignee ? ` · ${card.assignee}` : "";
	return `${card.column}${label}`;
}

function formatTimestamp(value?: string) {
	if (!value) return "Unknown";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

defineExpose({
	saveTrack,
});
</script>

<template>
	<div class="grid content-start gap-4" data-testid="track-editor">
		<div class="app-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Track editor sections">
			<button
				v-for="tab in baseTabs"
				:key="tab.id"
				type="button"
				class="shell-tab-button shrink-0"
				:class="{ 'is-active': activeTab === tab.id }"
				role="tab"
				:aria-selected="activeTab === tab.id"
				@click="selectTab(tab.id)"
			>
				{{ tab.label }}
				<span v-if="tab.id === 'decisions' && decisions.length" class="shell-count">{{ decisions.length }}</span>
				<span v-if="tab.id === 'references' && references.length" class="shell-count">{{ references.length }}</span>
				<span v-if="tab.id === 'cards' && linkedCards.length" class="shell-count">{{ linkedCards.length }}</span>
			</button>
			<button
				v-for="file in fileTabs"
				:key="file.name"
				type="button"
				class="shell-tab-button shrink-0"
				:class="{ 'is-active': activeTab === `file:${file.name}` }"
				role="tab"
				:aria-selected="activeTab === `file:${file.name}`"
				@click="selectTab(`file:${file.name}`)"
			>
				<span class="max-w-32 truncate">{{ file.name }}</span>
			</button>
			<button
				type="button"
				class="shell-tab-button shrink-0"
				:class="{ 'is-active': activeTab === 'new-file' }"
				role="tab"
				:aria-selected="activeTab === 'new-file'"
				:disabled="!canWriteFiles"
				@click="selectTab('new-file')"
			>
				Doc
			</button>
		</div>

		<section v-if="activeTab === 'track'" class="shell-section">
			<div>
				<p class="shell-section-title">Track</p>
				<p class="mt-1 text-sm text-muted-foreground">Tracks hold durable context above the card layer.</p>
			</div>
			<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				Title
				<Input v-model="title" autocomplete="off" placeholder="Inspector rewrite" />
			</label>
			<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				<span>Summary</span>
				<MarkdownEditor v-model="summary" placeholder="What is this track trying to accomplish?" />
			</div>
		</section>

		<section v-else-if="activeTab === 'brief'" class="shell-section">
			<div>
				<p class="shell-section-title">Brief</p>
				<p class="mt-1 text-sm text-muted-foreground">Durable context, goals, constraints, and desired end state.</p>
			</div>
			<MarkdownEditor v-model="brief" placeholder="Write the track brief in markdown." />
		</section>

		<section v-else-if="activeTab === 'decisions'" class="shell-section">
			<div>
				<p class="shell-section-title">Decisions</p>
				<p class="mt-1 text-sm text-muted-foreground">Capture important choices without rewriting the whole track narrative.</p>
			</div>
			<div v-if="decisions.length > 0" class="grid gap-2">
				<div
					v-for="decision in decisions"
					:key="decision.id"
					class="rounded-[2px] border border-border/80 bg-secondary/55 px-3 py-3"
				>
					<div class="flex items-center justify-between gap-2">
						<span class="text-sm font-medium text-foreground">{{ decision.title }}</span>
						<div class="flex items-center gap-2">
							<Badge variant="outline">{{ decision.status }}</Badge>
							<Tooltip content="Edit decision" side="top">
								<Button variant="ghost" size="icon" type="button" aria-label="Edit decision" @click="startDecisionEdit(decision)">
									<Save class="h-4 w-4" />
								</Button>
							</Tooltip>
							<Tooltip content="Remove decision" side="top">
								<Button variant="ghost" size="icon" type="button" aria-label="Remove decision" @click="decisions = decisions.filter((entry) => entry.id !== decision.id)">
									<Trash2 class="h-4 w-4" />
								</Button>
							</Tooltip>
						</div>
					</div>
					<p v-if="decision.body" class="mt-2 text-xs text-muted-foreground">{{ decision.body }}</p>
					<p class="mt-2 font-mono text-[10px] text-muted-foreground">{{ formatTimestamp(decision.updatedAt) }}</p>
				</div>
			</div>
			<div class="rounded-[2px] border border-dashed border-border/75 bg-background/20 p-3">
				<Input v-model="decisionDraft.title" autocomplete="off" placeholder="Decision title" />
				<Input v-model="decisionDraft.body" class="mt-2" autocomplete="off" placeholder="Why this matters" />
				<div class="mt-2 flex items-center gap-2">
					<Select v-model="decisionDraft.status" :options="decisionStatusOptions" class="w-36" />
					<Button v-if="editingDecisionId" variant="outline" type="button" @click="cancelDecisionEdit">
						Cancel
					</Button>
					<Button type="button" :disabled="!decisionDraft.title.trim()" @click="editingDecisionId ? saveDecisionEdit() : addDecision()">
						{{ editingDecisionId ? "Save" : "Add" }}
					</Button>
				</div>
			</div>
		</section>

		<section v-else-if="activeTab === 'references'" class="shell-section">
			<div>
				<p class="shell-section-title">References</p>
				<p class="mt-1 text-sm text-muted-foreground">Keep repo paths, cards, branches, worktrees, and URLs close to execution.</p>
			</div>
			<div v-if="references.length > 0" class="grid gap-2">
				<div
					v-for="reference in references"
					:key="reference.id"
					class="flex items-center justify-between gap-3 rounded-[2px] border border-border/80 bg-secondary/55 px-3 py-2"
				>
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-foreground">{{ reference.label }}</p>
						<p class="truncate text-xs text-muted-foreground">{{ reference.value }}</p>
					</div>
					<div class="flex items-center gap-2">
						<Badge variant="outline">{{ reference.kind }}</Badge>
						<Tooltip content="Edit reference" side="top">
							<Button variant="ghost" size="icon" type="button" aria-label="Edit reference" @click="startReferenceEdit(reference)">
								<Save class="h-4 w-4" />
							</Button>
						</Tooltip>
						<Tooltip content="Remove reference" side="top">
							<Button variant="ghost" size="icon" type="button" aria-label="Remove reference" @click="references = references.filter((entry) => entry.id !== reference.id)">
								<Trash2 class="h-4 w-4" />
							</Button>
						</Tooltip>
					</div>
				</div>
			</div>
			<div class="rounded-[2px] border border-dashed border-border/75 bg-background/20 p-3">
				<Input v-model="referenceDraft.label" autocomplete="off" placeholder="Reference label" />
				<Input v-model="referenceDraft.value" class="mt-2" autocomplete="off" placeholder="repo/path.ts or https://..." />
				<div class="mt-2 flex items-center gap-2">
					<Select v-model="referenceDraft.kind" :options="referenceKindOptions" class="w-40" />
					<Button v-if="editingReferenceId" variant="outline" type="button" @click="cancelReferenceEdit">
						Cancel
					</Button>
					<Button type="button" :disabled="!referenceDraft.label.trim() || !referenceDraft.value.trim()" @click="editingReferenceId ? saveReferenceEdit() : addReference()">
						{{ editingReferenceId ? "Save" : "Add" }}
					</Button>
				</div>
			</div>
		</section>

		<section v-else-if="activeTab === 'cards'" class="shell-section">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="shell-section-title">Linked cards</p>
					<p class="mt-1 text-xs text-muted-foreground">Cards currently executing inside this track.</p>
				</div>
				<Badge variant="outline">{{ linkedCards.length }}</Badge>
			</div>
			<div v-if="linkedCards.length > 0" class="grid gap-2">
				<button
					v-for="card in linkedCards"
					:key="card.id"
					type="button"
					class="rounded-[2px] border border-border/80 bg-secondary/55 px-3 py-2 text-left transition hover:border-primary/35"
					@click="emit('editCard', card)"
				>
					<div class="flex items-center justify-between gap-3">
						<div class="min-w-0">
							<div class="truncate text-sm font-medium text-foreground">{{ card.title }}</div>
							<div class="mt-1 font-mono text-[10px] text-muted-foreground">{{ linkedCardSubtitle(card) }}</div>
						</div>
						<Badge variant="outline">{{ card.comments.length }} notes</Badge>
					</div>
				</button>
			</div>
			<div v-else class="rounded-[2px] border border-dashed border-border/70 bg-background/20 px-3 py-8 text-center text-sm text-muted-foreground">
				No cards are linked to this track yet.
			</div>
		</section>

		<section v-else class="shell-section">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="shell-section-title">{{ activeTab === "new-file" ? "New doc" : fileName || "Track doc" }}</p>
					<p class="mt-1 text-xs text-muted-foreground">Free-form markdown docs for notes, snippets, and handoff context.</p>
				</div>
				<Badge variant="outline">{{ fileTabs.length }} files</Badge>
			</div>
			<div v-if="!canWriteFiles" class="rounded-[2px] border border-dashed border-border/70 bg-background/20 px-3 py-8 text-center text-sm text-muted-foreground">
				Save the track before adding markdown docs.
			</div>
			<template v-else>
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					File name
					<Input v-model="fileName" autocomplete="off" placeholder="context.md" />
				</label>
				<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					<span>File content</span>
					<MarkdownEditor v-model="fileContent" placeholder="Track notes, snippets, or handoff context." />
				</div>
				<div class="flex items-center justify-end gap-2">
					<Button variant="outline" type="button" :disabled="!fileName.trim()" @click="deleteCurrentFile">
						Delete
					</Button>
					<Button type="button" :disabled="!fileName.trim()" @click="saveCurrentFile">
						Save
					</Button>
				</div>
			</template>
		</section>
	</div>
</template>
