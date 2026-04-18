import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { desktop } from "@/electron/renderer";
import type { BoardScopeMode, Confirmation } from "@/ui/viewTypes";
import type {
	Card as TrackboiCard,
	ProjectSnapshot,
	Track,
	TrackPatch,
} from "@/core/types";
import type { SelectOption } from "@/ui/components/Select.vue";

type ConfirmationRequester = (confirmation: Confirmation) => void;

type TrackWorkflow = {
	selectedTrackId: Ref<string | null>;
	trackInspectorOpen: Ref<boolean>;
	trackInspectorMode: Ref<"create" | "edit">;
	selectedTrackFileName: Ref<string>;
	selectedTrackFileContent: Ref<string>;
	tracks: ComputedRef<Track[]>;
	selectedTrack: ComputedRef<Track | null>;
	linkedTrackCards: ComputedRef<TrackboiCard[]>;
	trackLabels: ComputedRef<Record<string, string>>;
	cardTrackOptions: ComputedRef<SelectOption[]>;
	trackFilterOptions: ComputedRef<SelectOption[]>;
	closeTrackInspector(): void;
	selectTrackFilter(trackId: string): void;
	openCreateTrack(): void;
	saveTrack(patch: Required<Pick<TrackPatch, "title" | "source" | "summary" | "plan" | "decisions" | "references" | "activity">>): Promise<void>;
	deleteSelectedTrack(track: Track): Promise<void>;
	loadSelectedTrackFile(fileName: string): Promise<void>;
	writeSelectedTrackFile(fileName: string, content: string): Promise<void>;
	deleteSelectedTrackFile(fileName: string): Promise<void>;
};

/**
 * Keeps track selection, inspector state, and track-file interactions together
 * so board filtering and track editing stay synchronized.
 */
export function useTrackWorkflow(options: {
	snapshot: Ref<ProjectSnapshot | null>;
	boardScopeMode: Ref<BoardScopeMode>;
	run(action: () => Promise<void>): Promise<void>;
	requestConfirmation: ConfirmationRequester;
}): TrackWorkflow {
	const selectedTrackId = ref<string | null>(null);
	const trackInspectorOpen = ref(false);
	const trackInspectorMode = ref<"create" | "edit">("edit");
	const selectedTrackFileName = ref("");
	const selectedTrackFileContent = ref("");

	const tracks = computed(() => options.snapshot.value?.tracks ?? []);
	const selectedTrack = computed(() => (
		tracks.value.find((track) => track.id === selectedTrackId.value) ?? null
	));
	const linkedTrackCards = computed(() => (
		selectedTrackId.value
			? (options.snapshot.value?.cards ?? []).filter((card) => card.trackId === selectedTrackId.value)
			: []
	));
	const trackLabels = computed<Record<string, string>>(() => Object.fromEntries(
		tracks.value.map((track) => [track.id, track.title]),
	));
	const cardTrackOptions = computed<SelectOption[]>(() => [
		{ value: "", label: "No track" },
		...tracks.value.map((track) => ({
			value: track.id,
			label: track.source.kind === "branch" ? `${track.title} (${track.source.ref})` : track.title,
		})),
	]);
	const trackFilterOptions = computed<SelectOption[]>(() => {
		const counts = new Map<string, number>();
		for (const card of options.snapshot.value?.cards ?? []) {
			if (!card.parentId && card.trackId) {
				counts.set(card.trackId, (counts.get(card.trackId) ?? 0) + 1);
			}
		}

		return [
			{ value: "__all__", label: "All tracks" },
			...tracks.value.map((track) => ({
				value: track.id,
				label: `${track.title} (${counts.get(track.id) ?? 0})`,
			})),
		];
	});

	watch(
		() => options.snapshot.value,
		(nextSnapshot) => {
			if (selectedTrackId.value && !nextSnapshot?.tracks.some((track) => track.id === selectedTrackId.value)) {
				selectedTrackId.value = null;
				trackInspectorOpen.value = false;
				selectedTrackFileName.value = "";
				selectedTrackFileContent.value = "";
			}
		},
		{ immediate: true },
	);

	function closeTrackInspector() {
		trackInspectorOpen.value = false;
		trackInspectorMode.value = "edit";
		selectedTrackId.value = null;
		selectedTrackFileName.value = "";
		selectedTrackFileContent.value = "";
	}

	function selectTrackFilter(trackId: string) {
		if (trackId === "__all__") {
			selectedTrackId.value = null;
			trackInspectorOpen.value = false;
			return;
		}

		selectedTrackId.value = trackId;
		trackInspectorMode.value = "edit";
		trackInspectorOpen.value = true;
		options.boardScopeMode.value = "all";
		selectedTrackFileName.value = "";
		selectedTrackFileContent.value = "";
	}

	function openCreateTrack() {
		trackInspectorMode.value = "create";
		trackInspectorOpen.value = true;
		selectedTrackFileName.value = "";
		selectedTrackFileContent.value = "";
	}

	async function saveTrack(patch: Required<Pick<TrackPatch, "title" | "source" | "summary" | "plan" | "decisions" | "references" | "activity">>) {
		await options.run(async () => {
			if (trackInspectorMode.value === "create" || !selectedTrack.value) {
				const created = await desktop.createTrack(patch);
				selectedTrackId.value = created.id;
				trackInspectorMode.value = "edit";
				trackInspectorOpen.value = true;
				return;
			}

			await desktop.updateTrack(selectedTrack.value.id, patch);
		});
	}

	async function deleteSelectedTrack(track: Track) {
		options.requestConfirmation({
			title: `Delete ${track.title}?`,
			description: "Cards will stay, but they will be detached from this track and related track files will be removed.",
			confirmLabel: "Delete",
			destructive: true,
			onConfirm: async () => {
				await options.run(async () => {
					await desktop.deleteTrack(track.id);
					if (selectedTrackId.value === track.id) {
						selectedTrackId.value = null;
						closeTrackInspector();
					}
				});
			},
		});
	}

	async function loadSelectedTrackFile(fileName: string) {
		if (!selectedTrack.value) return;
		await options.run(async () => {
			const result = await desktop.readTrackFile(selectedTrack.value!.id, fileName);
			selectedTrackFileName.value = result.name;
			selectedTrackFileContent.value = result.content;
		});
	}

	async function writeSelectedTrackFile(fileName: string, content: string) {
		if (!selectedTrack.value) return;
		await options.run(async () => {
			await desktop.writeTrackFile({
				trackId: selectedTrack.value!.id,
				name: fileName,
				content,
			});
			selectedTrackFileName.value = fileName;
			selectedTrackFileContent.value = content;
		});
	}

	async function deleteSelectedTrackFile(fileName: string) {
		if (!selectedTrack.value) return;
		await options.run(async () => {
			await desktop.deleteTrackFile(selectedTrack.value!.id, fileName);
			if (selectedTrackFileName.value === fileName) {
				selectedTrackFileName.value = "";
				selectedTrackFileContent.value = "";
			}
		});
	}

	return {
		selectedTrackId,
		trackInspectorOpen,
		trackInspectorMode,
		selectedTrackFileName,
		selectedTrackFileContent,
		tracks,
		selectedTrack,
		linkedTrackCards,
		trackLabels,
		cardTrackOptions,
		trackFilterOptions,
		closeTrackInspector,
		selectTrackFilter,
		openCreateTrack,
		saveTrack,
		deleteSelectedTrack,
		loadSelectedTrackFile,
		writeSelectedTrackFile,
		deleteSelectedTrackFile,
	};
}
