import { onMounted, ref } from "vue";
import { newId } from "@/core/id";
import { desktop } from "@/electron/renderer";
import type { AgentRegistration, AppSettings } from "@/core/types";

type DetectedEditor = Awaited<ReturnType<typeof desktop.listDetectedEditors>>[number];

/**
 * Owns the app-wide settings that must be visible to both desktop UI and MCP,
 * so they live in the shared registry instead of renderer-only localStorage.
 */
export function useGlobalAppSettings() {
	const appSettings = ref<AppSettings>({
		version: 1,
		agents: [],
		agentContexts: [],
		editor: {
			preferredEditorId: "auto",
			customCommand: "",
		},
	});
	const detectedEditors = ref<DetectedEditor[]>([]);
	const loading = ref(false);

	async function refresh() {
		loading.value = true;
		try {
			const [nextSettings, editors] = await Promise.all([
				desktop.readAppSettings(),
				desktop.listDetectedEditors(),
			]);
			appSettings.value = nextSettings;
			detectedEditors.value = editors;
		} finally {
			loading.value = false;
		}
	}

	async function save(nextSettings: AppSettings) {
		appSettings.value = await desktop.updateAppSettings(nextSettings);
	}

	async function registerAgent(agent: Pick<AgentRegistration, "name" | "description">) {
		await save({
			...appSettings.value,
			agents: [
				...appSettings.value.agents,
				{
					id: newId("agent"),
					name: agent.name.trim(),
					description: agent.description.trim(),
				},
			],
		});
	}

	async function updateAgent(agentId: string, patch: Partial<Pick<AgentRegistration, "name" | "description">>) {
		await save({
			...appSettings.value,
			agents: appSettings.value.agents.map((agent) => (
				agent.id === agentId
					? {
						...agent,
						name: patch.name?.trim() ?? agent.name,
						description: patch.description?.trim() ?? agent.description,
					}
					: agent
			)),
		});
	}

	async function removeAgent(agentId: string) {
		await save({
			...appSettings.value,
			agents: appSettings.value.agents.filter((agent) => agent.id !== agentId),
		});
	}

	async function updateEditorPreference(preferredEditorId: string, customCommand: string) {
		await save({
			...appSettings.value,
			editor: {
				preferredEditorId,
				customCommand,
			},
		});
	}

	onMounted(() => {
		void refresh();
	});

	return {
		appSettings,
		detectedEditors,
		loading,
		refresh,
		registerAgent,
		updateAgent,
		removeAgent,
		updateEditorPreference,
	};
}
