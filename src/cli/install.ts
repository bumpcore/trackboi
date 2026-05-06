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
description: Use trackboi when its MCP tools are available, or read existing \`.trackboi\`, \`.etc/.trackboi\`, or \`.etc/trackboi\` files for context when present. Treat filesystem stores as read-only context unless the user explicitly asks to edit trackboi itself; create or update trackboi records through MCP tools, not by hand.
---

# trackboi 101 for agents

trackboi is a local-first workbench for repo-bound work. It gives humans and agents a shared kanban board plus durable project context, stored in git-friendly files and exposed through MCP tools when the integration is available.

Use it as a coordination layer, not as a requirement. In a mixed repo, some people may not use trackboi at all. Presence of a \`.trackboi\`, \`.etc/.trackboi\`, or \`.etc/trackboi\` folder means useful context may exist, but it does not mean you must create or update trackboi records for every task.

## Product Model

- Workspace: a user-registered repo or folder entry.
- Worktree: a discovered checkout variant with its own storage context.
- Project: the per-worktree identity and settings.
- Board: a kanban board inside a project.
- Column: a workflow state on a board, such as todo, doing, review, or done.
- Track: durable project-wide context for an ongoing workstream.
- Card: an executable board task that can optionally link to one track.

Tracks are for intent and memory: summary, brief, decisions, references, linked cards, and markdown docs.

Cards are for execution: concrete tasks, status, movement across columns, assignment, labels, fields, and progress comments.

## When To Use It

Use trackboi MCP tools when they are available and the work benefits from durable coordination:

- multi-step implementation, review, debugging, or research
- work that may continue across sessions or agents
- release, migration, cleanup, or feature tracks
- blockers, decisions, or handoff notes that should not be rediscovered
- board/status updates the user expects to persist

Do not force trackboi into trivial one-off chat, tiny edits, or repositories where the tool is not available. If only trackboi files are present, read them to catch up, then continue through normal repo work unless the user asks for trackboi updates.

## How To Orient

If MCP tools are available, start with one call:

\`\`\`text
orient_agent
\`\`\`

That returns the active MCP context, available projects, worktrees, active board, columns, custom fields, tracks, cards for the active board, registered agents, and next steps.

If \`orient_agent\` says no active agent is set, call \`list_agents\`, then \`set_active_agent\` or \`register_agent\` before using mutation tools.

If MCP tools are not available, do not fabricate tool results or claim trackboi is absent just because tools are missing. Check \`.trackboi\`, \`.etc/.trackboi\`, then \`.etc/trackboi\`, and read those files only to understand local context.

## How To Work

Starting substantial work:

\`\`\`text
orient_agent -> set_active_agent/register_agent -> create_track or get_track -> create_card -> add_card_comment
\`\`\`

Updating task progress:

\`\`\`text
orient_agent -> update_card or move_card -> add_card_comment
\`\`\`

Recording durable context:

\`\`\`text
orient_agent -> update_track -> add_track_decision -> add_track_reference -> write_track_file
\`\`\`

Managing board shape:

\`\`\`text
orient_agent -> set_active_board -> create_column/update_column/move_column/delete_column
\`\`\`

Cards should link to a track with \`trackId\` when they belong to a larger workstream. Leave \`trackId\` empty for board-wide tasks.

## Filesystem Rule

Never manually create, update, move, or delete trackboi records in the filesystem as a substitute for MCP tools. That includes board files, card folders, card comments, track files, project metadata, and indexes.

Reading existing files is fine for orientation. Mutating trackboi state should go through MCP tools, unless the user is explicitly asking you to develop or repair trackboi itself.

## Good Agent Behavior

- Keep updates short, factual, and useful to a future human or agent.
- Move cards as state changes instead of leaving stale columns.
- Add final comments with what changed, what was verified, and residual risk.
- Use track decisions for durable choices, not every passing thought.
- Use track docs for longer plans, research summaries, or handoff context.
- Avoid duplicating the entire chat transcript.
- Never invent board, column, card, or track ids; orient or list first.
`;

const OPENAI_YAML = `interface:
  display_name: "trackboi"
  short_description: "Use trackboi when available."
  default_prompt: "Use orient_agent when trackboi MCP tools are available; otherwise read existing trackboi files only for context."
`;

const AGENTS_BLOCK_START = "<trackboi>";
const AGENTS_BLOCK_END = "</trackboi>";

const AGENTS_SNIPPET = `## trackboi Skill

When trackboi MCP tools are available, agents can load \`.agents/skills/trackboi/SKILL.md\` for details, then call \`orient_agent\` to catch up before updating cards, tracks, boards, or handoff notes. If \`.trackboi\`, \`.etc/.trackboi\`, or \`.etc/trackboi\` files are present but MCP tools are not available, agents may read those files to catch up on local context. Do not manually create, update, or delete trackboi records in the filesystem; use MCP tools for mutations.
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

	const unwrappedSnippet = AGENTS_SNIPPET.trimEnd();
	if (current.includes(unwrappedSnippet)) {
		return current.replace(unwrappedSnippet, AGENTS_BLOCK.trimEnd());
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
