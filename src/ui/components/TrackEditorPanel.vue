<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { FileText, Plus, Save, Trash2 } from "lucide-vue-next";
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
	busy: boolean;
	mode: "create" | "edit";
	track: Track | null;
	currentBranch: string | null;
	linkedCards: TrackboiCard[];
	selectedFileName: string;
	selectedFileContent: string;
}>();

const emit = defineEmits<{
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
	() => [props.track, props.mode, props.currentBranch] as const,
	([track, mode, currentBranch]) => {
		title.value = track?.title ?? "";
		summary.value = track?.summary ?? "";
		plan.value = track?.plan ?? "";
		sourceKind.value = track?.source.kind ?? (currentBranch ? "branch" : "manual");
		sourceRef.value = track?.source.kind === "branch"
			? track.source.ref
			: (mode === "create" ? (currentBranch ?? "") : "");
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

defineExpose({
	saveTrack,
});
</script>

<template>
	<div class="grid content-start gap-5">
		<section class="shell-section">
			<div>
				<p class="shell-section-title">Track</p>
				<p class="mt-1 text-sm text-muted-foreground">Tracks hold durable context above the card layer.</p>
			</div>
			<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				Title
				<Input v-model="title" autocomplete="off" placeholder="Inspector rewrite" />
			</label>
			<div class="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Source
					<Select v-model="sourceKind" :options="sourceOptions" />
				</label>
				<label v-if="sourceKind === 'branch'" class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Branch ref
					<Input v-model="sourceRef" autocomplete="off" placeholder="feature/track-context" />
				</label>
			</div>
		</section>

		<section class="shell-section">
			<div>
				<p class="shell-section-title">Summary</p>
				<p class="mt-1 text-sm text-muted-foreground">Problem framing and current intent.</p>
			</div>
			<MarkdownEditor v-model="summary" placeholder="What is this track trying to accomplish?" />
		</section>

		<section class="shell-section">
			<div>
				<p class="shell-section-title">Plan</p>
				<p class="mt-1 text-sm text-muted-foreground">Keep the next steps and decisions close to the board.</p>
			</div>
			<MarkdownEditor v-model="plan" placeholder="Write the track-level plan in markdown." />
		</section>

		<section class="shell-section">
			<div>
				<p class="shell-section-title">Decisions</p>
			</div>
			<div v-if="decisions.length > 0" class="grid gap-2">
				<div
					v-for="decision in decisions"
					:key="decision.id"
					class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3"
				>
					<div class="flex items-center justify-between gap-2">
						<span class="text-sm font-medium text-foreground">{{ decision.title }}</span>
						<div class="flex items-center gap-2">
							<Badge variant="outline">{{ decision.status }}</Badge>
							<Button variant="ghost" size="icon" type="button" @click="decisions = decisions.filter((entry) => entry.id !== decision.id)">
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					</div>
					<p v-if="decision.body" class="mt-2 text-xs text-muted-foreground">{{ decision.body }}</p>
				</div>
			</div>
			<div class="rounded-md border border-dashed border-border/75 bg-background/20 p-3">
				<Input v-model="decisionDraft.title" autocomplete="off" placeholder="Decision title" />
				<Input v-model="decisionDraft.body" class="mt-2" autocomplete="off" placeholder="Why this matters" />
				<div class="mt-2 flex items-center gap-2">
					<Select v-model="decisionDraft.status" :options="decisionStatusOptions" class="w-36" />
					<Button type="button" :disabled="!decisionDraft.title.trim()" @click="addDecision">
						<Plus class="h-4 w-4" />
						Add
					</Button>
				</div>
			</div>
		</section>

		<section class="shell-section">
			<div>
				<p class="shell-section-title">References</p>
			</div>
			<div v-if="references.length > 0" class="grid gap-2">
				<div
					v-for="reference in references"
					:key="reference.id"
					class="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-secondary/55 px-3 py-2"
				>
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-foreground">{{ reference.label }}</p>
						<p class="truncate text-xs text-muted-foreground">{{ reference.value }}</p>
					</div>
					<div class="flex items-center gap-2">
						<Badge variant="outline">{{ reference.kind }}</Badge>
						<Button variant="ghost" size="icon" type="button" @click="references = references.filter((entry) => entry.id !== reference.id)">
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
			<div class="rounded-md border border-dashed border-border/75 bg-background/20 p-3">
				<Input v-model="referenceDraft.label" autocomplete="off" placeholder="Reference label" />
				<Input v-model="referenceDraft.value" class="mt-2" autocomplete="off" placeholder="repo/path.ts or https://..." />
				<div class="mt-2 flex items-center gap-2">
					<Select v-model="referenceDraft.kind" :options="referenceKindOptions" class="w-40" />
					<Button type="button" :disabled="!referenceDraft.label.trim() || !referenceDraft.value.trim()" @click="addReference">
						<Plus class="h-4 w-4" />
						Add
					</Button>
				</div>
			</div>
		</section>

		<section class="shell-section">
			<div>
				<p class="shell-section-title">Activity</p>
			</div>
			<div v-if="activity.length > 0" class="grid gap-2">
				<div
					v-for="entry in activity"
					:key="entry.id"
					class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3"
				>
					<div class="flex items-center justify-between gap-2">
						<span class="text-sm font-medium text-foreground">{{ entry.createdBy }}</span>
						<Button variant="ghost" size="icon" type="button" @click="activity = activity.filter((candidate) => candidate.id !== entry.id)">
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
					<MarkdownContent :value="entry.body" class="mt-2 text-sm text-foreground" />
				</div>
			</div>
			<div class="rounded-md border border-dashed border-border/75 bg-background/20 p-3">
				<MarkdownEditor v-model="activityBody" placeholder="Write a handoff or investigation note." />
				<div class="mt-2 flex justify-end">
					<Button type="button" :disabled="!activityBody.trim()" @click="addActivity">
						<Plus class="h-4 w-4" />
						Add note
					</Button>
				</div>
			</div>
		</section>

		<section class="shell-section">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="shell-section-title">Files</p>
					<p class="mt-1 text-xs text-muted-foreground">Text-first attachment files for notes and snippets.</p>
				</div>
				<Badge variant="outline">{{ props.linkedCards.length }} linked cards</Badge>
			</div>
			<div v-if="track?.files.length" class="grid gap-2">
				<button
					v-for="file in track.files"
					:key="file.name"
					type="button"
					class="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-secondary/55 px-3 py-2 text-left transition hover:border-primary/35"
					@click="emit('loadFile', file.name)"
				>
					<div class="min-w-0">
						<p class="truncate text-sm text-foreground">{{ file.name }}</p>
						<p class="font-mono text-[10px] text-muted-foreground">{{ file.updatedAt }}</p>
					</div>
					<FileText class="h-4 w-4 text-muted-foreground" />
				</button>
			</div>
			<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				File name
				<Input v-model="fileName" autocomplete="off" placeholder="notes/context.md" :disabled="!canWriteFiles" />
			</label>
			<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
				<span>File content</span>
				<MarkdownEditor v-model="fileContent" placeholder="Track notes, snippets, or JSON context." />
			</div>
			<div class="flex items-center justify-end gap-2">
				<Button variant="outline" type="button" :disabled="!canWriteFiles || !fileName.trim()" @click="emit('deleteFile', fileName)">
					<Trash2 class="h-4 w-4" />
					Delete file
				</Button>
				<Button type="button" :disabled="!canWriteFiles || !fileName.trim()" @click="emit('writeFile', fileName, fileContent)">
					<Save class="h-4 w-4" />
					Save file
				</Button>
			</div>
		</section>

		<section v-if="linkedCards.length > 0" class="shell-section">
			<div>
				<p class="shell-section-title">Linked cards</p>
			</div>
			<div class="grid gap-2">
				<button
					v-for="card in linkedCards"
					:key="card.id"
					type="button"
					class="rounded-md border border-border/80 bg-secondary/55 px-3 py-2 text-left transition hover:border-primary/35"
					@click="emit('editCard', card)"
				>
					<div class="text-sm font-medium text-foreground">{{ card.title }}</div>
					<div class="mt-1 font-mono text-[10px] text-muted-foreground">{{ card.column }}</div>
				</button>
			</div>
		</section>

	</div>
</template>
