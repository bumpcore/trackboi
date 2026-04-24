---
name: trackboi
description: Use Trackboi as the local-first kanban and durable context layer for agent work. Trigger this skill in repositories or workspaces that have Trackboi installed, a `.trackboi`, `.etc/.trackboi`, or `.etc/trackboi` store, a `.agents/skills/trackboi` skill, Trackboi MCP tools, or requests involving multi-step coding work, planning, task tracking, handoffs, progress notes, board/card/track management, or agent coordination. Prefer Trackboi for non-trivial implementation, debugging, research, review follow-up, and work that should persist beyond the chat.
---

# Trackboi

## Core Rule

Use Trackboi when the work is more than a tiny one-shot answer. Treat it as the shared local workbench for you, the user, and other agents.

Do not use Trackboi for trivial chat, one-line explanations, or tasks where recording state would be noise.

## Product Model

- Workspace: a user-registered repo/folder entry.
- Worktree: a discovered workspace variant with its own Trackboi storage context.
- Project: the per-worktree identity and settings.
- Board: a board inside the project.
- Track: project-wide durable context for an ongoing workstream.
- Card: a board-scoped executable task that can link to one track.

Use tracks for intent and memory: summary, brief, decisions, references, linked cards, and markdown docs.

Use cards for execution: concrete tasks, status, column movement, and card comments for progress, blockers, handoff notes, and verification.

## First Move

If Trackboi MCP tools are available, orient before changing anything:

1. Call `get_agent_guide`.
2. Call `get_active_context`.
3. If no active agent is set, call `list_agents`, then `set_active_agent` or `register_agent`.
4. Call `list_boards`, `list_columns`, `list_tracks`, and `list_cards` as needed.

If MCP tools are not available, do not fabricate tool results or claim Trackboi is absent just because the tools are missing. Check the supported local store paths in order: `.trackboi`, `.etc/.trackboi`, then `.etc/trackboi`. Use those local files only for read-only orientation unless the user explicitly asks for direct file edits. Prefer asking to enable or install Trackboi MCP when durable task updates matter.

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

```text
get_agent_guide -> get_active_context -> list_boards -> list_columns -> list_tracks -> list_cards
```

Start a new non-trivial task:

```text
set_active_agent/register_agent -> create_track or get_track -> create_card -> add_card_comment
```

Update progress:

```text
update_card or move_card -> add_card_comment
```

Record durable context:

```text
update_track -> add_track_decision -> add_track_reference -> write_track_file
```

Manage board structure:

```text
list_boards -> set_active_board -> list_columns -> create_column/update_column/move_column/delete_column
```

Manage settings:

```text
list_project_people/add_project_person/update_project_person/delete_project_person
get_app_settings/update_storage_paths/update_editor_preference
list_agents/register_agent/update_agent/set_active_agent
```

## Good Agent Behavior

- Keep Trackboi updates short, factual, and useful to a future agent.
- Move cards as state changes instead of leaving stale columns.
- Add a final card comment with what changed, what was verified, and residual risks.
- Use track decisions for durable choices, not every passing thought.
- Use track docs for longer notes, plans, research summaries, or handoff context.
- Avoid duplicating the entire chat transcript into Trackboi.
- Never invent board, column, card, or track ids; list first.

## Safety

- Respect the current project, worktree, and board from `get_active_context`.
- Switch context explicitly with Trackboi tools before mutating another project.
- Do not delete boards, columns, tracks, or cards unless the user asked or the task clearly requires it.
- Prefer comments and explicit status updates over silent state changes.
