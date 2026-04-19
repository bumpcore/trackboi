<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { FileText, Plus, Save, Trash2, X } from "lucide-vue-next";
import { newId } from "@/core/id";
import type {
	Card as TrackboiCard,
	CardComment,
	Track,
	TrackDecision,
	TrackDecisionStatus,
	TrackPatch,
	TrackReference,
	TrackReferenceKind,
	TrackSource,
} from "@/core/types";
import Badge from "@/ui/components/Badge.vue";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import MarkdownContent from "@/ui/components/MarkdownContent.vue";
import MarkdownEditor from "@/ui/components/MarkdownEditor.vue";
import Select from "@/ui/components/Select.vue";
import type { SelectOption } from "@/ui/components/Select.vue";

const props = defineProps<{
	open: boolean;
	busy: boolean;
	mode: "create" | "edit";
	track: Track | null;
	currentBranch: string | null;
	linkedCards: TrackboiCard[];
	selectedFileName: string;
	selectedFileContent: string;
}>();

const emit = defineEmits<{
	close: [];
	save: [patch: Required<Pick<TrackPatch, "title" | "source" | "summary" | "plan" | "decisions" | "references" | "activity">>];
	delete: [track: Track];
	loadFile: [fileName: string];
	writeFile: [fileName: string, content: string];
	deleteFile: [fileName: string];
	editCard: [card: TrackboiCard];
}>();

const title = ref("");
const summary = ref("");
const plan = ref("");
const sourceKind = ref<TrackSource["kind"]>("manual");
const sourceRef = ref("");
const decisions = ref<TrackDecision[]>([]);
const references = ref<TrackReference[]>([]);
const activity = ref<CardComment[]>([]);

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
const activityBody = ref("");
const fileName = ref("");
const fileContent = ref("");

const sourceOptions: SelectOption[] = [
	{ value: "manual", label: "Manual" },
	{ value: "branch", label: "Branch-backed" },
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

function cloneActivity(values: CardComment[]): CardComment[] {
	return values.map((value) => ({ ...value }));
}

watch(
	() => [props.track, props.mode, props.currentBranch, props.open] as const,
	([track, mode, currentBranch, open]) => {
		if (!open) return;

		title.value = track?.title ?? "";
		summary.value = track?.summary ?? "";
		plan.value = track?.plan ?? "";
		sourceKind.value = track?.source.kind ?? (currentBranch ? "branch" : "manual");
		sourceRef.value = track?.source.kind === "branch" ? track.source.ref : (mode === "create" ? (currentBranch ?? "") : "");
		decisions.value = cloneDecisions(track?.decisions ?? []);
		references.value = cloneReferences(track?.references ?? []);
		activity.value = cloneActivity(track?.activity ?? []);
		fileName.value = "";
		fileContent.value = "";
	},
	{ immediate: true },
);

watch(
	() => [props.selectedFileName, props.selectedFileContent] as const,
	([nextName, nextContent]) => {
		if (!nextName) return;
		fileName.value = nextName;
		fileContent.value = nextContent;
	},
);

const panelTitle = computed(() => props.mode === "create" ? "New Track" : "Track Inspector");
const canWriteFiles = computed(() => props.mode === "edit" && props.track != null);

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

function removeDecision(decisionId: string) {
	decisions.value = decisions.value.filter((decision) => decision.id !== decisionId);
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

function removeReference(referenceId: string) {
	references.value = references.value.filter((reference) => reference.id !== referenceId);
}

function addActivity() {
	if (!activityBody.value.trim()) return;
	const timestamp = new Date().toISOString();
	activity.value = [
		...activity.value,
		{
			id: newId("comment"),
			cardId: props.track?.id ?? "track_activity",
			body: activityBody.value.trim(),
			createdAt: timestamp,
			updatedAt: timestamp,
			createdBy: props.track?.updatedBy ?? props.track?.createdBy ?? "person_unknown",
			updatedBy: props.track?.updatedBy ?? props.track?.createdBy ?? "person_unknown",
		},
	];
	activityBody.value = "";
}

function removeActivity(activityId: string) {
	activity.value = activity.value.filter((entry) => entry.id !== activityId);
}

function saveTrack() {
	if (!title.value.trim()) return;
	const source: TrackSource = sourceKind.value === "branch" && sourceRef.value.trim()
		? { kind: "branch", ref: sourceRef.value.trim() }
		: { kind: "manual" };

	emit("save", {
		title: title.value.trim(),
		source,
		summary: summary.value,
		plan: plan.value,
		decisions: decisions.value,
		references: references.value,
		activity: activity.value,
	});
}

function requestFile(name: string) {
	emit("loadFile", name);
}

function saveFile() {
	if (!canWriteFiles.value || !fileName.value.trim()) return;
	emit("writeFile", fileName.value.trim(), fileContent.value);
}

function removeFile() {
	if (!canWriteFiles.value || !fileName.value.trim()) return;
	emit("deleteFile", fileName.value.trim());
	fileName.value = "";
	fileContent.value = "";
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
</script>

<template>
	<aside
		v-if="open"
		class="grid h-full min-h-0 w-[360px] grid-rows-[auto_minmax(0,1fr)_auto] border-l border-border/55 bg-card/88 backdrop-blur-sm"
	>
		<header class="flex items-start justify-between gap-3 border-b border-border/55 px-4 py-4">
			<div class="min-w-0">
				<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">
					{{ mode === "create" ? "Create Track" : "Track" }}
				</p>
				<h2 class="mt-1 truncate text-lg font-semibold text-foreground">{{ panelTitle }}</h2>
				<p class="mt-1 text-sm text-muted-foreground">Plan, decisions, references, files, and handoff context.</p>
			</div>
			<Button variant="ghost" size="icon" type="button" @click="$emit('close')">
				<X class="h-4 w-4" />
			</Button>
		</header>

		<div class="app-scroll grid min-h-0 content-start gap-4 overflow-auto px-4 py-4">
			<section class="grid gap-3">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Title
					<Input v-model="title" autocomplete="off" placeholder="Inspector rewrite track" />
				</label>
				<div class="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Source
						<Select v-model="sourceKind" :options="sourceOptions" />
					</label>
					<label v-if="sourceKind === 'branch'" class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Branch ref
						<Input v-model="sourceRef" autocomplete="off" placeholder="feat/track-context" />
					</label>
				</div>
			</section>

			<section class="grid gap-2">
				<div>
					<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Summary</p>
					<p class="mt-1 text-xs text-muted-foreground">Problem framing and current intent.</p>
				</div>
				<MarkdownEditor v-model="summary" placeholder="What is this track trying to accomplish?" />
			</section>

			<section class="grid gap-2">
				<div>
					<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Plan</p>
					<p class="mt-1 text-xs text-muted-foreground">Next steps, checkpoints, and evolving implementation notes.</p>
				</div>
				<MarkdownEditor v-model="plan" placeholder="Write the track-level plan in markdown." />
			</section>

			<section class="grid gap-3 border-t border-border/45 pt-4">
				<div>
					<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Decisions</p>
				</div>
				<div v-if="decisions.length > 0" class="grid gap-2">
					<div
						v-for="decision in decisions"
						:key="decision.id"
						class="grid gap-2 rounded-md border border-border/60 bg-background/30 p-3"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="text-sm font-medium text-foreground">{{ decision.title }}</span>
							<div class="flex items-center gap-2">
								<Badge variant="secondary">{{ decision.status }}</Badge>
								<Button variant="ghost" size="icon" type="button" @click="removeDecision(decision.id)">
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>
						<p v-if="decision.body" class="text-xs text-muted-foreground">{{ decision.body }}</p>
					</div>
				</div>
				<div class="grid gap-2 rounded-md border border-dashed border-border/60 p-3">
					<Input v-model="decisionDraft.title" autocomplete="off" placeholder="Decision title" />
					<Input v-model="decisionDraft.body" autocomplete="off" placeholder="Why this matters" />
					<div class="flex items-center gap-2">
						<Select v-model="decisionDraft.status" :options="decisionStatusOptions" class="w-36" />
						<Button type="button" :disabled="!decisionDraft.title.trim()" @click="addDecision">
							<Plus class="h-4 w-4" />
							Add decision
						</Button>
					</div>
				</div>
			</section>

			<section class="grid gap-3 border-t border-border/45 pt-4">
				<div>
					<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">References</p>
				</div>
				<div v-if="references.length > 0" class="grid gap-2">
					<div
						v-for="reference in references"
						:key="reference.id"
						class="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/30 px-3 py-2"
					>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-foreground">{{ reference.label }}</p>
							<p class="truncate text-xs text-muted-foreground">{{ reference.value }}</p>
						</div>
						<div class="flex items-center gap-2">
							<Badge variant="outline">{{ reference.kind }}</Badge>
							<Button variant="ghost" size="icon" type="button" @click="removeReference(reference.id)">
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
				<div class="grid gap-2 rounded-md border border-dashed border-border/60 p-3">
					<Input v-model="referenceDraft.label" autocomplete="off" placeholder="Label" />
					<Input v-model="referenceDraft.value" autocomplete="off" placeholder="Path, card id, branch, or URL" />
					<div class="flex items-center gap-2">
						<Select v-model="referenceDraft.kind" :options="referenceKindOptions" class="w-36" />
						<Button type="button" :disabled="!referenceDraft.label.trim() || !referenceDraft.value.trim()" @click="addReference">
							<Plus class="h-4 w-4" />
							Add reference
						</Button>
					</div>
				</div>
			</section>

			<section class="grid gap-3 border-t border-border/45 pt-4">
				<div>
					<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Activity</p>
				</div>
				<div v-if="activity.length > 0" class="grid gap-2">
					<article
						v-for="entry in activity"
						:key="entry.id"
						class="grid gap-2 rounded-md border border-border/60 bg-background/30 p-3"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="text-sm font-medium text-foreground">{{ entry.createdBy }}</span>
							<div class="flex items-center gap-2">
								<span class="text-xs text-muted-foreground">{{ formatTimestamp(entry.createdAt) }}</span>
								<Button variant="ghost" size="icon" type="button" @click="removeActivity(entry.id)">
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>
						<MarkdownContent :value="entry.body" class="text-sm text-foreground" />
					</article>
				</div>
				<div class="grid gap-2 rounded-md border border-dashed border-border/60 p-3">
					<MarkdownEditor v-model="activityBody" placeholder="Add a handoff, investigation note, or update." />
					<Button type="button" :disabled="!activityBody.trim()" @click="addActivity">
						<Plus class="h-4 w-4" />
						Add activity
					</Button>
				</div>
			</section>

			<section class="grid gap-3 border-t border-border/45 pt-4">
				<div>
					<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Files</p>
					<p class="mt-1 text-xs text-muted-foreground">Small repo-local notes and snippets attached to this track.</p>
				</div>
				<div v-if="track?.files.length" class="grid gap-2">
					<button
						v-for="file in track.files"
						:key="file.name"
						class="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/30 px-3 py-2 text-left hover:border-primary/35"
						type="button"
						@click="requestFile(file.name)"
					>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-foreground">{{ file.name }}</p>
							<p class="truncate text-xs text-muted-foreground">{{ file.contentType }}</p>
						</div>
						<span class="text-xs text-muted-foreground">{{ formatTimestamp(file.updatedAt) }}</span>
					</button>
				</div>
				<p v-else class="text-sm text-muted-foreground">No files attached yet.</p>
				<div class="grid gap-2 rounded-md border border-dashed border-border/60 p-3">
					<Input v-model="fileName" autocomplete="off" placeholder="notes.md" />
					<textarea
						v-model="fileContent"
						class="min-h-32 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground outline-none"
						:disabled="!canWriteFiles"
						placeholder="Save the track first, then add a file."
					/>
					<div class="flex gap-2">
						<Button type="button" :disabled="busy || !canWriteFiles || !fileName.trim()" @click="saveFile">
							<FileText class="h-4 w-4" />
							Save file
						</Button>
						<Button variant="outline" type="button" :disabled="busy || !canWriteFiles || !fileName.trim()" @click="removeFile">
							Delete file
						</Button>
					</div>
				</div>
			</section>

			<section class="grid gap-3 border-t border-border/45 pt-4">
				<div class="flex items-center justify-between gap-2">
					<div>
						<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Linked Cards</p>
						<p class="mt-1 text-xs text-muted-foreground">{{ linkedCards.length }} cards reference this track.</p>
					</div>
				</div>
				<div v-if="linkedCards.length > 0" class="grid gap-2">
					<button
						v-for="card in linkedCards"
						:key="card.id"
						class="rounded-md border border-border/60 bg-background/30 px-3 py-2 text-left hover:border-primary/35"
						type="button"
						@click="$emit('editCard', card)"
					>
						<p class="text-sm font-medium text-foreground">{{ card.title }}</p>
						<p class="text-xs text-muted-foreground">{{ card.column }}</p>
					</button>
				</div>
				<p v-else class="text-sm text-muted-foreground">No cards are linked to this track yet.</p>
			</section>
		</div>

		<div class="flex gap-2 border-t border-border/55 px-4 py-4">
			<Button type="button" :disabled="busy || !title.trim()" @click="saveTrack">
				<Save class="h-4 w-4" />
				{{ mode === "create" ? "Create track" : "Save track" }}
			</Button>
			<Button variant="outline" type="button" :disabled="busy" @click="$emit('close')">
				Close
			</Button>
			<Button
				v-if="track"
				class="ml-auto"
				variant="destructive"
				type="button"
				:disabled="busy"
				@click="$emit('delete', track)"
			>
				<Trash2 class="h-4 w-4" />
				Delete
			</Button>
		</div>
	</aside>
</template>
