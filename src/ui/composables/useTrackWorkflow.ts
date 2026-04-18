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
export const NO_TRACK_SELECT_VALUE = "__none__";

type TrackPanelMode = "create" | "edit";

type TrackWorkflow = {
	selectedTrackId: Ref<string | null>;
	panelMode: Ref<TrackPanelMode>;
	selectedTrackFileName: Ref<string>;
	selectedTrackFileContent: Ref<string>;
	tracks: ComputedRef<Track[]>;
	selectedTrack: ComputedRef<Track | null>;
	linkedTrackCards: ComputedRef<TrackboiCard[]>;
	trackLabels: ComputedRef<Record<string, string>>;
	cardTrackOptions: ComputedRef<SelectOption[]>;
	clearTrackSelection(): void;
	selectTrack(trackId: string): void;
	openCreateTrack(): void;
	saveTrack(patch: Required<Pick<TrackPatch, "title" | "source" | "summary" | "plan" | "decisions" | "references" | "activity">>): Promise<void>;
	deleteSelectedTrack(track: Track): Promise<void>;
	loadSelectedTrackFile(fileName: string): Promise<void>;
	writeSelectedTrackFile(fileName: string, content: string): Promise<void>;
	deleteSelectedTrackFile(fileName: string): Promise<void>;
};

/**
 * Keeps the active track filter and the track editor subject in one place so
 * the board scope and the right-side panel stay synchronized.
 */
export function useTrackWorkflow(options: {
	snapshot: Ref<ProjectSnapshot | null>;
	boardScopeMode: Ref<BoardScopeMode>;
	run(action: () => Promise<void>): Promise<void>;
	requestConfirmation: ConfirmationRequester;
}): TrackWorkflow {
	const selectedTrackId = ref<string | null>(null);
	const panelMode = ref<TrackPanelMode>("edit");
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
		{ value: NO_TRACK_SELECT_VALUE, label: "No track" },
		...tracks.value.map((track) => ({
			value: track.id,
			label: track.source.kind === "branch" ? `${track.title} (${track.source.ref})` : track.title,
		})),
	]);

	watch(
		() => options.snapshot.value,
		(nextSnapshot) => {
			if (selectedTrackId.value && !nextSnapshot?.tracks.some((track) => track.id === selectedTrackId.value)) {
				selectedTrackId.value = null;
				selectedTrackFileName.value = "";
				selectedTrackFileContent.value = "";
			}
		},
		{ immediate: true },
	);

	function clearTrackSelection() {
		selectedTrackId.value = null;
		panelMode.value = "edit";
		selectedTrackFileName.value = "";
		selectedTrackFileContent.value = "";
	}

	function selectTrack(trackId: string) {
		if (trackId === "__all__") {
			clearTrackSelection();
			return;
		}

		selectedTrackId.value = trackId;
		panelMode.value = "edit";
		options.boardScopeMode.value = "all";
		selectedTrackFileName.value = "";
		selectedTrackFileContent.value = "";
	}

	function openCreateTrack() {
		panelMode.value = "create";
		selectedTrackFileName.value = "";
		selectedTrackFileContent.value = "";
	}

	async function saveTrack(patch: Required<Pick<TrackPatch, "title" | "source" | "summary" | "plan" | "decisions" | "references" | "activity">>) {
		await options.run(async () => {
			if (panelMode.value === "create" || !selectedTrack.value) {
				const created = await desktop.createTrack(patch);
				selectedTrackId.value = created.id;
				panelMode.value = "edit";
				return;
			}

			await desktop.updateTrack(selectedTrack.value.id, patch);
		});
	}

	async function deleteSelectedTrack(track: Track) {
		options.requestConfirmation({
			title: `Delete ${track.title}?`,
			description: "Cards stay on the board, but they will be detached from this track and related track files will be removed.",
			confirmLabel: "Delete",
			destructive: true,
			onConfirm: async () => {
				await options.run(async () => {
					await desktop.deleteTrack(track.id);
					if (selectedTrackId.value === track.id) clearTrackSelection();
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
		panelMode,
		selectedTrackFileName,
		selectedTrackFileContent,
		tracks,
		selectedTrack,
		linkedTrackCards,
		trackLabels,
		cardTrackOptions,
		clearTrackSelection,
		selectTrack,
		openCreateTrack,
		saveTrack,
		deleteSelectedTrack,
		loadSelectedTrackFile,
		writeSelectedTrackFile,
		deleteSelectedTrackFile,
	};
}
