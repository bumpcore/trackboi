import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { newId } from "../../core/id";
import type { AgentRegistration, AppSettings, CustomField, FieldType, NodeFsTrackboiActions, PersonAlias } from "../../core";
import { boardIdSchema, type McpProjectContext, projectPathSchema, requireAgentId, requireSnapshot, toMcpCard, toolResult, withProject } from "./helpers";

function updateAgents(settings: AppSettings, updater: (agents: AgentRegistration[]) => AgentRegistration[]): AppSettings {
	return {
		...settings,
		agents: updater(settings.agents),
	};
}

const fieldTypeSchema = z.enum(["text", "number", "checkbox", "select", "date"]);

function fieldIdFromName(name: string): string {
	const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	return slug || newId("field").slice(-8).toLowerCase();
}

function normalizeFieldOptions(type: FieldType, options?: string[]): string[] | undefined {
	if (type !== "select") return undefined;
	const normalized = (options ?? []).map((option) => option.trim()).filter(Boolean);
	if (normalized.length === 0) throw new Error("Select fields need at least one option");
	return normalized;
}

function agentGuidePayload() {
	return {
		workflow: [
			"Call orient_agent first to get the MCP session context, active project, worktree, board, columns, fields, tracks, cards, and agent identity in one response.",
			"If no active agent is set, call list_agents, then set_active_agent or register_agent before mutating cards/tracks/boards.",
			"Use tracks for project-wide durable feature/workstream context: summary, brief, decisions, references, linked cards, and markdown docs.",
			"Use cards for executable board tasks. Link cards to trackId when they belong to a larger workstream.",
			"Append card comments for progress, handoff notes, blockers, and verification results.",
			"Use list_board_fields before setting card fieldValues, then update_card with the complete fieldValues object.",
			"Prefer explicit projectPath when operating outside the cwd-selected project; otherwise the MCP session uses its isolated active project.",
		],
		commonFlows: {
			orient: ["orient_agent"],
			startWork: ["set_active_agent", "create_track or get_track", "create_card", "add_card_comment"],
			updateWork: ["update_card or move_card", "add_card_comment", "add_track_decision or write_track_file when context should live beyond one card"],
			switchContext: ["orient_agent", "switch_project", "list_worktrees", "set_active_worktree", "set_active_board"],
			settings: ["list_project_people", "add_project_person", "update_storage_paths", "update_editor_preference"],
		},
		terms: {
			workspace: "A user-registered repo/folder entry.",
			worktree: "A discovered workspace variant with its own storage context.",
			project: "The per-worktree project identity and settings.",
			board: "A first-class board inside a worktree project.",
			track: "A project-wide work container for durable intent, context, files, decisions, references, and linked cards across boards.",
			card: "A board-scoped executable task that can optionally link to one track.",
		},
	};
}

/**
 * Registers MCP tools that inspect or switch Trackboi projects and worktrees.
 */
export function registerProjectTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("get_agent_guide", {
		title: "Get agent guide",
		description: "Return the recommended trackboi MCP workflow for agents: orient, choose context, mutate safely, and leave useful progress notes.",
	}, () => toolResult(() => agentGuidePayload()));

	server.registerTool("orient_agent", {
		title: "Orient agent",
		description: "Return one agent-ready orientation payload: guide, active MCP context, projects, worktrees, board shape, tracks, active-board cards, agents, and next steps.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(async () => {
		const view = await context.listView();
		const settings = await trackboi.readAppSettings();
		const activeAgentId = await context.currentAgentId();
		const resolvedProjectPath = projectPath ?? view.activeProjectPath ?? undefined;
		const state = await withProject(trackboi, context, resolvedProjectPath, (actions) => actions.readDesktopState());
		const snapshot = state.snapshot;
		const activeBoardId = snapshot?.board.id ?? state.selectedBoardId;
		const activeBoardCards = snapshot && activeBoardId
			? snapshot.cards.filter((card) => card.boardId === activeBoardId)
			: [];
		const contextMismatch = Boolean(
			projectPath &&
			view.agentActiveProjectPath &&
			projectPath !== view.agentActiveProjectPath,
		);

		return {
			guide: agentGuidePayload(),
			context: {
				cwd: view.cwd,
				requestedProjectPath: projectPath ?? null,
				activeProjectPath: resolvedProjectPath ?? null,
				activeWorktreeId: state.selectedWorktreeId,
				activeBoardId,
				agentActiveProjectPath: view.agentActiveProjectPath,
				desktopActiveProjectPath: view.desktopActiveProjectPath,
				agentActiveWorktreeId: view.agentActiveWorktreeId,
				desktopActiveWorktreeId: view.desktopActiveWorktreeId,
				agentActiveBoardId: view.agentActiveBoardId,
				desktopActiveBoardId: view.desktopActiveBoardId,
				contextMismatch,
				activeAgentId,
				activeAgent: settings.agents.find((agent) => agent.id === activeAgentId) ?? null,
			},
			projects: view.sources,
			storageSearchPaths: view.storageSearchPaths,
			worktrees: {
				activeWorktreeId: state.selectedWorktreeId,
				items: state.worktrees,
			},
			project: snapshot ? {
				project: snapshot.project,
				metadata: snapshot.metadata,
				git: snapshot.git,
			} : null,
			board: snapshot ? {
				activeBoardId: snapshot.board.id,
				activeBoard: snapshot.board,
				boards: snapshot.boards,
				columns: snapshot.board.columns,
				customFields: snapshot.board.customFields,
			} : null,
			tracks: snapshot?.tracks ?? [],
			cards: {
				boardId: activeBoardId,
				items: activeBoardCards.map(toMcpCard),
			},
			agents: {
				activeAgentId,
				items: settings.agents,
			},
			nextSteps: [
				...(contextMismatch ? ["Requested project differs from the MCP session project; use switch_project to make it the default, or keep passing projectPath explicitly."] : []),
				...(activeAgentId
					? ["Use the returned board columns before create_card or move_card.", "Use trackId when a card belongs to a track.", "Use comments for progress, blockers, handoff, and verification notes."]
					: ["Call list_agents, then set_active_agent or register_agent before mutating cards, tracks, or boards."]),
			],
		};
	}));

	server.registerTool("list_projects", {
		title: "List projects",
		description: "List local Trackboi workspaces and show which project this MCP session currently targets.",
	}, () => toolResult(() => context.listView()));

	server.registerTool("get_active_project", {
		title: "Get active project",
		description: "Return the MCP session's active project snapshot: project metadata, git context, active board, boards, tracks, and cards.",
	}, () => toolResult(() => withProject(trackboi, context, undefined, (actions) => actions.getActiveProject())));

	server.registerTool("get_active_context", {
		title: "Get active context",
		description: "Return this MCP session's isolated project/worktree/board/agent context without changing the desktop UI.",
	}, () => toolResult(async () => {
		const view = await context.listView();
		const settings = await trackboi.readAppSettings();
		const activeAgentId = await context.currentAgentId();
		return {
			...view,
			activeAgentId,
			activeAgent: settings.agents.find((agent) => agent.id === activeAgentId) ?? null,
			availableAgents: settings.agents,
			nextSteps: activeAgentId
				? ["Use list_boards/list_columns/list_tracks/list_cards to orient before mutating."]
				: ["Call list_agents, then set_active_agent or register_agent before mutating."],
		};
	}));

	server.registerTool("get_app_settings", {
		title: "Get app settings",
		description: "Return global Trackboi settings that are also visible in the desktop Settings modal: agent identities, editor preference, and storage path priority.",
	}, () => toolResult(async () => {
		const view = await context.listView();
		return {
			appSettings: await trackboi.readAppSettings(),
			storageSearchPaths: view.storageSearchPaths,
		};
	}));

	server.registerTool("update_editor_preference", {
		title: "Update editor preference",
		description: "Update the desktop Settings > Editor preference.",
		inputSchema: {
			preferredEditorId: z.string().min(1).describe("Editor id, usually auto, custom, or a detected editor id."),
			customCommand: z.string().optional().describe("Shell command used when preferredEditorId is custom. Use {path} as the file placeholder."),
		},
	}, ({ preferredEditorId, customCommand }) => toolResult(async () => {
		await requireAgentId(trackboi, context);
		const settings = await trackboi.readAppSettings();
		return trackboi.updateAppSettings({
			...settings,
			editor: {
				preferredEditorId,
				customCommand: customCommand?.trim() ?? settings.editor.customCommand,
			},
		});
	}));

	server.registerTool("update_storage_paths", {
		title: "Update storage paths",
		description: "Replace the global storage search path priority from desktop Settings > Storage. Paths must be repo-relative.",
		inputSchema: {
			paths: z.array(z.string().min(1)).min(1),
		},
	}, ({ paths }) => toolResult(async () => {
		await requireAgentId(trackboi, context);
		return trackboi.setStorageSearchPaths(paths);
	}));

	server.registerTool("list_git_changes", {
		title: "List git changes",
		description: "List changed files that the active project's default git commit action would include. Pass paths to inspect a narrower explicit set.",
		inputSchema: {
			projectPath: projectPathSchema,
			paths: z.array(z.string().min(1)).optional(),
		},
	}, ({ projectPath, paths }) => toolResult(() => withProject(trackboi, context, projectPath, (actions) => (
		actions.listGitChanges(paths)
	))));

	server.registerTool("commit_project_changes", {
		title: "Commit project changes",
		description: "Commit the active project's trackboi-managed git changes. Defaults to the project storage path so unrelated user work is not committed.",
		inputSchema: {
			projectPath: projectPathSchema,
			message: z.string().min(1).describe("Commit message."),
			paths: z.array(z.string().min(1)).optional().describe("Optional explicit repo-relative paths to commit instead of the default trackboi storage path."),
		},
	}, ({ projectPath, message, paths }) => toolResult(async () => {
		await requireAgentId(trackboi, context);
		return withProject(trackboi, context, projectPath, (actions) => actions.commitGitChanges({ message, paths }));
	}));

	server.registerTool("list_project_people", {
		title: "List project people",
		description: "List project-scoped people aliases from project settings. These aliases are used for attribution and assignment labels.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(async () => {
		const snapshot = await requireSnapshot(trackboi, context, projectPath);
		return snapshot.metadata.people;
	}));

	server.registerTool("add_project_person", {
		title: "Add project person",
		description: "Add a project-scoped person alias, matching Current project settings in the desktop UI.",
		inputSchema: {
			projectPath: projectPathSchema,
			displayName: z.string().min(1),
			gitEmails: z.array(z.string()).optional(),
			gitNames: z.array(z.string()).optional(),
		},
	}, ({ projectPath, displayName, gitEmails, gitNames }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const person: PersonAlias = {
			id: newId("person"),
			displayName: displayName.trim(),
			gitEmails: (gitEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean),
			gitNames: (gitNames ?? []).map((name) => name.trim()).filter(Boolean),
		};
		return actions.updateProjectPeople([...snapshot.metadata.people, person]);
	})));

	server.registerTool("update_project_person", {
		title: "Update project person",
		description: "Patch a project-scoped person alias.",
		inputSchema: {
			projectPath: projectPathSchema,
			personId: z.string().min(1),
			displayName: z.string().min(1).optional(),
			gitEmails: z.array(z.string()).optional(),
			gitNames: z.array(z.string()).optional(),
		},
	}, ({ projectPath, personId, displayName, gitEmails, gitNames }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		if (!snapshot.metadata.people.some((person) => person.id === personId)) throw new Error(`Unknown person alias: ${personId}`);
		return actions.updateProjectPeople(snapshot.metadata.people.map((person) => (
			person.id === personId
				? {
					...person,
					displayName: displayName?.trim() ?? person.displayName,
					gitEmails: gitEmails?.map((email) => email.trim().toLowerCase()).filter(Boolean) ?? person.gitEmails,
					gitNames: gitNames?.map((name) => name.trim()).filter(Boolean) ?? person.gitNames,
				}
				: person
		)));
	})));

	server.registerTool("delete_project_person", {
		title: "Delete project person",
		description: "Remove a project-scoped person alias from Current project settings.",
		inputSchema: {
			projectPath: projectPathSchema,
			personId: z.string().min(1),
		},
	}, ({ projectPath, personId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		return actions.updateProjectPeople(snapshot.metadata.people.filter((person) => person.id !== personId));
	})));

	server.registerTool("list_worktrees", {
		title: "List worktrees",
		description: "List worktrees for the MCP session's active project so an agent can pick the correct filesystem context.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(async () => {
		const state = await withProject(trackboi, context, projectPath, (actions) => actions.readDesktopState());
		return state.worktrees;
	}));

	server.registerTool("switch_project", {
		title: "Switch project",
		description: "Switch this MCP session's active project without changing the desktop app's selected project.",
		inputSchema: {
			projectPath: z.string().min(1),
		},
	}, ({ projectPath }) => toolResult(async () => {
		await context.setCurrentProjectPath(projectPath);
		return withProject(trackboi, context, projectPath, (actions) => actions.getActiveProject());
	}));

	server.registerTool("set_active_worktree", {
		title: "Set active worktree",
		description: "Switch this MCP session's active worktree inside a project without changing the desktop app's selected worktree.",
		inputSchema: {
			projectPath: projectPathSchema,
			worktreeId: z.string().min(1),
		},
	}, ({ projectPath, worktreeId }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		const result = await withProject(trackboi, context, resolvedProjectPath, async (actions) => {
			await actions.setSelectedWorktree(worktreeId);
			const snapshot = await actions.getActiveProject();
			return {
				worktreeId,
				snapshot,
			};
		});
		await context.setCurrentWorktreeId(resolvedProjectPath, worktreeId);
		await context.setCurrentBoardId(resolvedProjectPath, result.snapshot?.board.id ?? null);
		return result;
	}));

	server.registerTool("clear_active_worktree", {
		title: "Clear active worktree",
		description: "Clear this MCP session's explicit worktree selection and fall back to the project's default worktree.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		const result = await withProject(trackboi, context, resolvedProjectPath, async (actions) => {
			const state = await actions.readDesktopState();
			return {
				worktrees: state.worktrees,
				selectedWorktreeId: state.selectedWorktreeId,
				selectedBoardId: state.selectedBoardId,
			};
		});
		await context.setCurrentWorktreeId(resolvedProjectPath, result.selectedWorktreeId);
		await context.setCurrentBoardId(resolvedProjectPath, result.selectedBoardId);
		return result;
	}));

	server.registerTool("list_agents", {
		title: "List agents",
		description: "List registered agent identities and show which one will be stamped on MCP mutations.",
	}, () => toolResult(async () => {
		const settings = await trackboi.readAppSettings();
		return {
			activeAgentId: await context.currentAgentId(),
			agents: settings.agents,
		};
	}));

	server.registerTool("register_agent", {
		title: "Register agent",
		description: "Register a durable agent identity and make it active for this MCP session. Do this before creating or changing work.",
		inputSchema: {
			name: z.string().min(1),
			description: z.string().optional(),
		},
	}, ({ name, description }) => toolResult(async () => {
		const settings = await trackboi.readAppSettings();
		const agent: AgentRegistration = {
			id: newId("agent"),
			name: name.trim(),
			description: description?.trim() ?? "",
		};
		await trackboi.updateAppSettings(updateAgents(settings, (agents) => [...agents, agent]));
		await context.setCurrentAgentId(agent.id);
		return {
			activeAgentId: agent.id,
			agent,
		};
	}));

	server.registerTool("update_agent", {
		title: "Update agent",
		description: "Rename or describe an existing registered agent identity.",
		inputSchema: {
			agentId: z.string().min(1),
			name: z.string().min(1).optional(),
			description: z.string().optional(),
		},
	}, ({ agentId, name, description }) => toolResult(async () => {
		const settings = await trackboi.readAppSettings();
		let updatedAgent: AgentRegistration | null = null;
		const nextSettings = updateAgents(settings, (agents) => agents.map((agent) => {
			if (agent.id !== agentId) return agent;
			updatedAgent = {
				...agent,
				name: name?.trim() ?? agent.name,
				description: description?.trim() ?? agent.description,
			};
			return updatedAgent;
		}));
		if (!updatedAgent) throw new Error(`Unknown agent: ${agentId}`);
		await trackboi.updateAppSettings(nextSettings);
		return {
			activeAgentId: await context.currentAgentId(),
			agent: updatedAgent,
		};
	}));

	server.registerTool("set_active_agent", {
		title: "Set active agent",
		description: "Set the active registered agent for this MCP session. Required before mutation tools can write.",
		inputSchema: {
			agentId: z.string().min(1),
		},
	}, ({ agentId }) => toolResult(async () => {
		const settings = await trackboi.readAppSettings();
		if (!settings.agents.some((agent) => agent.id === agentId)) throw new Error(`Unknown agent: ${agentId}`);
		await context.setCurrentAgentId(agentId);
		return {
			activeAgentId: await context.currentAgentId(),
		};
	}));
}

/**
 * Registers board-level read tools that expose the current board shape without
 * reaching into storage or runtime internals directly.
 */
export function registerBoardTools(server: McpServer, trackboi: NodeFsTrackboiActions, context: McpProjectContext): void {
	server.registerTool("list_boards", {
		title: "List boards",
		description: "List boards for the active project and identify the board this MCP session currently targets.",
		inputSchema: {
			projectPath: projectPathSchema,
		},
	}, ({ projectPath }) => toolResult(() => withProject(trackboi, context, projectPath, async () => {
		const snapshot = await requireSnapshot(trackboi, context, projectPath);
		return {
			activeBoardId: snapshot.board.id,
			boards: snapshot.boards,
		};
	})));

	server.registerTool("set_active_board", {
		title: "Set active board",
		description: "Switch this MCP session's active board without changing the desktop UI shell.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: z.string().min(1),
		},
	}, ({ projectPath, boardId }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		await context.setCurrentBoardId(resolvedProjectPath, boardId);
		return withProject(trackboi, context, resolvedProjectPath, async (actions) => {
			await actions.setActiveBoard(boardId);
			return actions.getActiveProject();
		});
	}));

	server.registerTool("create_board", {
		title: "Create board",
		description: "Create a board in the active project and make it this MCP session's active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			name: z.string().min(1),
		},
	}, ({ projectPath, name }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		await requireAgentId(trackboi, context);
		const snapshot = await withProject(trackboi, context, resolvedProjectPath, (actions) => actions.createBoard({ name }));
		await context.setCurrentBoardId(resolvedProjectPath, snapshot.board.id);
		return snapshot;
	}));

	server.registerTool("delete_board", {
		title: "Delete board",
		description: "Delete a board after its cards have been moved out. Tracks are project-wide and do not block board deletion.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: z.string().min(1),
		},
	}, ({ projectPath, boardId }) => toolResult(async () => {
		const resolvedProjectPath = projectPath ?? await context.currentProjectPath();
		if (!resolvedProjectPath) throw new Error("Choose a project first");
		await requireAgentId(trackboi, context);
		const snapshot = await withProject(trackboi, context, resolvedProjectPath, (actions) => actions.deleteBoard(boardId));
		await context.setCurrentBoardId(resolvedProjectPath, snapshot.board.id);
		return snapshot;
	}));

	server.registerTool("update_board", {
		title: "Update board",
		description: "Rename the active board or a board by id, matching the desktop Board settings modal.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			name: z.string().min(1),
		},
	}, ({ projectPath, boardId, name }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		return actions.updateBoard({
			...snapshot.board,
			name: name.trim(),
		});
	})));

	server.registerTool("list_columns", {
		title: "List columns",
		description: "List valid column ids for the active board. Call before create_card or move_card.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
		},
	}, ({ projectPath, boardId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		return snapshot.board.columns;
	})));

	server.registerTool("list_board_fields", {
		title: "List board fields",
		description: "List custom fields for the active board. Use before update_card fieldValues.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
		},
	}, ({ projectPath, boardId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		return snapshot.board.customFields;
	})));

	server.registerTool("create_board_field", {
		title: "Create board field",
		description: "Create a custom field on the active board, matching desktop Board settings.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			name: z.string().min(1),
			type: fieldTypeSchema,
			options: z.array(z.string()).optional().describe("Required for select fields; ignored for other field types."),
		},
	}, ({ projectPath, boardId, name, type, options }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const trimmedName = name.trim();
		const existingIds = new Set(snapshot.board.customFields.map((field) => field.id));
		let id = fieldIdFromName(trimmedName);
		while (existingIds.has(id)) id = `${fieldIdFromName(trimmedName)}-${newId("field").slice(-6).toLowerCase()}`;
		const fieldOptions = normalizeFieldOptions(type, options);
		const field: CustomField = {
			id,
			name: trimmedName,
			type,
			...(fieldOptions ? { options: fieldOptions } : {}),
		};
		return actions.updateBoard({
			...snapshot.board,
			customFields: [...snapshot.board.customFields, field],
		});
	})));

	server.registerTool("update_board_field", {
		title: "Update board field",
		description: "Rename or reconfigure a custom field on the active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			fieldId: z.string().min(1),
			name: z.string().min(1).optional(),
			type: fieldTypeSchema.optional(),
			options: z.array(z.string()).optional().describe("Replacement select options when type is select."),
		},
	}, ({ projectPath, boardId, fieldId, name, type, options }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		if (!snapshot.board.customFields.some((field) => field.id === fieldId)) throw new Error(`Unknown board field: ${fieldId}`);
		return actions.updateBoard({
			...snapshot.board,
			customFields: snapshot.board.customFields.map((field) => {
				if (field.id !== fieldId) return field;
				const nextType = type ?? field.type;
				const nextOptions = options !== undefined || type !== undefined
					? normalizeFieldOptions(nextType, options ?? field.options)
					: field.options;
				return {
					id: field.id,
					name: name?.trim() ?? field.name,
					type: nextType,
					...(nextOptions ? { options: nextOptions } : {}),
				};
			}),
		});
	})));

	server.registerTool("delete_board_field", {
		title: "Delete board field",
		description: "Remove a custom field from the active board. Existing card field values for that field are no longer shown by the UI.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			fieldId: z.string().min(1),
		},
	}, ({ projectPath, boardId, fieldId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		return actions.updateBoard({
			...snapshot.board,
			customFields: snapshot.board.customFields.filter((field) => field.id !== fieldId),
		});
	})));

	server.registerTool("create_column", {
		title: "Create column",
		description: "Append a new workflow column to the active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			name: z.string().min(1),
		},
	}, ({ projectPath, boardId, name }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || newId("column").slice(-8).toLowerCase();
		let id = slug;
		const existing = new Set(snapshot.board.columns.map((column) => column.id));
		while (existing.has(id)) id = `${slug}-${newId("column").slice(-6).toLowerCase()}`;
		const board = {
			...snapshot.board,
			columns: [...snapshot.board.columns, { id, name: name.trim() }],
		};
		return actions.updateBoard(board);
	})));

	server.registerTool("update_column", {
		title: "Update column",
		description: "Rename an existing column on the active board.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			columnId: z.string().min(1),
			name: z.string().min(1),
		},
	}, ({ projectPath, boardId, columnId, name }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const exists = snapshot.board.columns.some((column) => column.id === columnId);
		if (!exists) throw new Error(`Unknown column: ${columnId}`);
		return actions.updateBoard({
			...snapshot.board,
			columns: snapshot.board.columns.map((column) => column.id === columnId ? { ...column, name: name.trim() } : column),
		});
	})));

	server.registerTool("delete_column", {
		title: "Delete column",
		description: "Delete an empty column from the active board. Move or delete cards first.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			columnId: z.string().min(1),
		},
	}, ({ projectPath, boardId, columnId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		if (snapshot.board.columns.length <= 1) throw new Error("Board needs at least one column");
		if (snapshot.cards.some((card) => card.column === columnId)) throw new Error("Move or delete cards before removing this column");
		return actions.updateBoard({
			...snapshot.board,
			columns: snapshot.board.columns.filter((column) => column.id !== columnId),
		});
	})));

	server.registerTool("move_column", {
		title: "Move column",
		description: "Reorder a column before another column, or move it to the end when beforeColumnId is null.",
		inputSchema: {
			projectPath: projectPathSchema,
			boardId: boardIdSchema,
			columnId: z.string().min(1),
			beforeColumnId: z.string().nullable().optional(),
		},
	}, ({ projectPath, boardId, columnId, beforeColumnId }) => toolResult(() => withProject(trackboi, context, projectPath, async (actions) => {
		await requireAgentId(trackboi, context);
		if (boardId) await actions.setActiveBoard(boardId);
		const snapshot = await actions.getActiveProject();
		if (!snapshot) throw new Error("Choose a project first");
		const columns = [...snapshot.board.columns];
		const movingIndex = columns.findIndex((column) => column.id === columnId);
		if (movingIndex < 0) throw new Error(`Unknown column: ${columnId}`);
		const [moving] = columns.splice(movingIndex, 1);
		const insertIndex = beforeColumnId
			? columns.findIndex((column) => column.id === beforeColumnId)
			: columns.length;
		if (beforeColumnId && insertIndex < 0) throw new Error(`Unknown column: ${beforeColumnId}`);
		columns.splice(insertIndex < 0 ? columns.length : insertIndex, 0, moving);
		return actions.updateBoard({
			...snapshot.board,
			columns,
		});
	})));
}
