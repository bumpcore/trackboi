---
name: trackboi
description: Use trackboi when its MCP tools are available, or read existing `.trackboi`, `.etc/.trackboi`, or `.etc/trackboi` files for context when present. Treat filesystem stores as read-only context unless the user explicitly asks to edit trackboi itself; create or update trackboi records through MCP tools, not by hand.
---

# trackboi 101 for agents

trackboi is a local-first workbench for repo-bound work. It gives humans and agents a shared kanban board plus durable project context, stored in git-friendly files and exposed through MCP tools when the integration is available.

Use it as a coordination layer, not as a requirement. In a mixed repo, some people may not use trackboi at all. Presence of a `.trackboi`, `.etc/.trackboi`, or `.etc/trackboi` folder means useful context may exist, but it does not mean you must create or update trackboi records for every task.

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

```text
orient_agent
```

That returns the active MCP context, available projects, worktrees, active board, columns, custom fields, tracks, cards for the active board, registered agents, and next steps.

If `orient_agent` says no active agent is set, call `list_agents`, then `set_active_agent` or `register_agent` before using mutation tools.

If MCP tools are not available, do not fabricate tool results or claim trackboi is absent just because tools are missing. Check `.trackboi`, `.etc/.trackboi`, then `.etc/trackboi`, and read those files only to understand local context.

## How To Work

Starting substantial work:

```text
orient_agent -> set_active_agent/register_agent -> create_track or get_track -> create_card -> add_card_comment
```

Updating task progress:

```text
orient_agent -> update_card or move_card -> add_card_comment
```

Recording durable context:

```text
orient_agent -> update_track -> add_track_decision -> add_track_reference -> write_track_file
```

Managing board shape:

```text
orient_agent -> set_active_board -> create_column/update_column/move_column/delete_column
```

Cards should link to a track with `trackId` when they belong to a larger workstream. Leave `trackId` empty for board-wide tasks.

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
