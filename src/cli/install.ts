import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type InstallOptions = {
	targetDir?: string;
	mcp?: boolean;
	skill?: boolean;
	agents?: boolean;
	all?: boolean;
	force?: boolean;
};

export type InstallResult = {
	targetDir: string;
	installed: string[];
	skipped: string[];
};

const SKILL_MD = `---
name: trackboi
description: Use trackboi as the local-first kanban and durable context layer for agent work. Trigger this skill in repositories or workspaces that have trackboi installed, a \`.trackboi\`, \`.etc/.trackboi\`, or \`.etc/trackboi\` store, a \`.agents/skills/trackboi\` skill, trackboi MCP tools, or requests involving multi-step coding work, planning, task tracking, handoffs, progress notes, board/card/track management, or agent coordination. Prefer trackboi for non-trivial implementation, debugging, research, review follow-up, and work that should persist beyond the chat.
---

# trackboi

## Core Rule

Use trackboi when the work is more than a tiny one-shot answer. Treat it as the shared local workbench for you, the user, and other agents.

Do not use trackboi for trivial chat, one-line explanations, or tasks where recording state would be noise.

## Product Model

- Workspace: a user-registered repo/folder entry.
- Worktree: a discovered workspace variant with its own trackboi storage context.
- Project: the per-worktree identity and settings.
- Board: a board inside the project.
- Track: project-wide durable context for an ongoing workstream.
- Card: a board-scoped executable task that can link to one track.

Use tracks for intent and memory: summary, brief, decisions, references, linked cards, and markdown docs.

Use cards for execution: concrete tasks, status, column movement, and card comments for progress, blockers, handoff notes, and verification.

## First Move

If trackboi MCP tools are available, orient before changing anything:

1. Call \`get_agent_guide\`.
2. Call \`get_active_context\`.
3. If no active agent is set, call \`list_agents\`, then \`set_active_agent\` or \`register_agent\`.
4. Call \`list_boards\`, \`list_columns\`, \`list_tracks\`, and \`list_cards\` as needed.

If MCP tools are not available, do not fabricate tool results or claim trackboi is absent just because the tools are missing. Check the supported local store paths in order: \`.trackboi\`, \`.etc/.trackboi\`, then \`.etc/trackboi\`. Use those local files only for read-only orientation unless the user explicitly asks for direct file edits. Prefer asking to enable or install trackboi MCP when durable task updates matter.

## When To Create Or Update Records

Create or update a card when:

- The user asks to implement, fix, review, investigate, or finish something non-trivial.
- The task has multiple steps, tests, hidden risk, or may continue later.
- You discover a blocker or follow-up that should not be lost.
- You finish work and need to leave verification or handoff notes.

Create or update a track when:

- The work belongs to a larger feature, migration, cleanup, release, investigation, or ongoing effort.
- Context should survive across boards, branches, sessions, or agents.
- You need to record decisions, constraints, references, or long-form notes.

Prefer linking new cards to the relevant track. A card may have zero or one owning track.

## Recommended MCP Flows

Orientation:

\`\`\`text
get_agent_guide -> get_active_context -> list_boards -> list_columns -> list_tracks -> list_cards
\`\`\`

Start a new non-trivial task:

\`\`\`text
set_active_agent/register_agent -> create_track or get_track -> create_card -> add_card_comment
\`\`\`

Update progress:

\`\`\`text
update_card or move_card -> add_card_comment
\`\`\`

Record durable context:

\`\`\`text
update_track -> add_track_decision -> add_track_reference -> write_track_file
\`\`\`

Manage board structure:

\`\`\`text
list_boards -> set_active_board -> list_columns -> create_column/update_column/move_column/delete_column
\`\`\`

Manage settings:

\`\`\`text
list_project_people/add_project_person/update_project_person/delete_project_person
get_app_settings/update_storage_paths/update_editor_preference
list_agents/register_agent/update_agent/set_active_agent
\`\`\`

## Good Agent Behavior

- Keep trackboi updates short, factual, and useful to a future agent.
- Move cards as state changes instead of leaving stale columns.
- Add a final card comment with what changed, what was verified, and residual risks.
- Use track decisions for durable choices, not every passing thought.
- Use track docs for longer notes, plans, research summaries, or handoff context.
- Avoid duplicating the entire chat transcript into trackboi.
- Never invent board, column, card, or track ids; list first.

## Safety

- Respect the current project, worktree, and board from \`get_active_context\`.
- Switch context explicitly with trackboi tools before mutating another project.
- Do not delete boards, columns, tracks, or cards unless the user asked or the task clearly requires it.
- Prefer comments and explicit status updates over silent state changes.
`;

const OPENAI_YAML = `interface:
  display_name: "trackboi"
  short_description: "Use trackboi for agent work."
  default_prompt: "Use trackboi to plan, track, and document this work when the task is non-trivial."
`;

const AGENTS_BLOCK_START = "<trackboi>";
const AGENTS_BLOCK_END = "</trackboi>";

const AGENTS_SNIPPET = `## trackboi Skill

Agents working in this repository should load \`.agents/skills/trackboi/SKILL.md\` when work is non-trivial, stateful, or useful to track beyond the current chat. Use trackboi MCP tools when available to orient, choose the active project/worktree/board, update cards, and leave handoff notes.
`;

const AGENTS_BLOCK = `${AGENTS_BLOCK_START}
${AGENTS_SNIPPET.trimEnd()}
${AGENTS_BLOCK_END}
`;

/**
 * Installs trackboi's project-local agent integration files.
 */
export function installTrackboi(options: InstallOptions = {}): InstallResult {
	const targetDir = path.resolve(options.targetDir ?? process.cwd());
	const shouldInstallAll = options.all === true || (!options.mcp && !options.skill && !options.agents);
	const result: InstallResult = {
		targetDir,
		installed: [],
		skipped: [],
	};

	if (shouldInstallAll || options.mcp) installMcpConfig(targetDir, options.force === true, result);
	if (shouldInstallAll || options.skill) installSkill(targetDir, options.force === true, result);
	if (shouldInstallAll || options.agents) installAgentGuide(targetDir, result);

	return result;
}

function installMcpConfig(targetDir: string, force: boolean, result: InstallResult) {
	const configPath = path.join(targetDir, ".mcp.json");
	const payload = existsSync(configPath) ? readJsonConfig(configPath, force) : {};
	const root = isRecord(payload) ? payload : {};
	const mcpServers = isRecord(root.mcpServers) ? root.mcpServers : {};

	mcpServers.trackboi = {
		command: "trackboi",
		args: ["mcp"],
	};
	root.mcpServers = mcpServers;

	writeTextFile(configPath, `${JSON.stringify(root, null, "\t")}\n`, force);
	result.installed.push(".mcp.json");
}

function installSkill(targetDir: string, force: boolean, result: InstallResult) {
	const skillDir = path.join(targetDir, ".agents", "skills", "trackboi");
	const agentsDir = path.join(skillDir, "agents");
	mkdirSync(agentsDir, { recursive: true });
	writeTextFile(path.join(skillDir, "SKILL.md"), SKILL_MD, force);
	writeTextFile(path.join(agentsDir, "openai.yaml"), OPENAI_YAML, force);
	result.installed.push(".agents/skills/trackboi");
}

function installAgentGuide(targetDir: string, result: InstallResult) {
	const agentsPath = path.join(targetDir, "AGENTS.md");
	if (existsSync(agentsPath)) {
		const current = readFileSync(agentsPath, "utf8");
		const next = upsertTrackboiAgentsBlock(current);
		if (next === current) {
			result.skipped.push("AGENTS.md");
			return;
		}
		writeFileSync(agentsPath, next, "utf8");
		result.installed.push("AGENTS.md");
		return;
	}

	writeFileSync(agentsPath, `# Agent Guide\n\n${AGENTS_BLOCK}`, "utf8");
	result.installed.push("AGENTS.md");
}

/**
 * Keeps trackboi-owned AGENTS.md guidance replaceable without touching the
 * repository's surrounding agent instructions.
 */
function upsertTrackboiAgentsBlock(current: string): string {
	const managedBlockPattern = new RegExp(`${AGENTS_BLOCK_START}[\\s\\S]*?${AGENTS_BLOCK_END}\\n?`, "m");
	if (managedBlockPattern.test(current)) {
		return current.replace(managedBlockPattern, AGENTS_BLOCK);
	}

	const legacySnippet = AGENTS_SNIPPET.trimEnd();
	if (current.includes(legacySnippet)) {
		return current.replace(legacySnippet, AGENTS_BLOCK.trimEnd());
	}

	return `${current.trimEnd()}\n\n${AGENTS_BLOCK}`;
}

function readJsonConfig(configPath: string, force: boolean): unknown {
	try {
		return JSON.parse(readFileSync(configPath, "utf8"));
	} catch (error) {
		if (!force) throw new Error(`Cannot parse ${configPath}. Re-run with --force to replace it.`);
		return {};
	}
}

function writeTextFile(filePath: string, content: string, force: boolean) {
	if (existsSync(filePath) && !force) {
		const current = readFileSync(filePath, "utf8");
		if (current === content) return;
	}
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
