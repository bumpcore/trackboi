# Trackboi Product Shape

Trackboi is a repo-local work context system.

The first surface is a Kanban board, but the product is not only Kanban. Trackboi should help humans and agents keep track of tasks, scoped branch work, decisions, memory, and handoff context inside a repository.

The desktop app is the primary product. MCP comes later as another client over the same core data and actions.

## Thesis

Trackboi stores structured work context in git-friendly files and exposes it through a focused desktop UI.

It should feel flexible enough for different repo workflows, but opinionated enough to avoid becoming a generic database builder.

Opinionated:

- Local-first.
- Repo-native.
- Plain files.
- Git-friendly layout.
- Task, board, memory, and decision primitives.
- Branch scope as a first-class concept.
- Simple schemas over clever abstractions.

Flexible:

- Multiple storage locations.
- Multiple boards per database.
- Branch-scoped and project-scoped cards.
- Custom card fields.
- Parent tasks and subtasks.
- Agent-friendly read/write operations later.

Non-goals for now:

- Cloud accounts.
- Realtime collaboration.
- Jira-style workflows.
- Notion-style arbitrary databases.
- Complex plugin systems.
- Fine-grained permissions inside a local repo.

## Storage Roots

Trackboi looks for its database under a project root using an ordered list of candidate paths.

Default candidates:

```txt
.etc/.trackboi
.etc/trackboi
.trackboi
```

This lets users hide Trackboi metadata under an existing project config folder if they prefer.

The lookup paths should be configurable later. The config should support adding, removing, and reordering candidates.

Example app config:

```json
{
  "storageSearchPaths": [".etc/.trackboi", ".etc/trackboi", ".trackboi"]
}
```

Per project, Trackboi should store the selected project path and the resolved storage path.

```json
{
  "id": "project_x",
  "name": "trackboi",
  "path": "/home/abdulkadir/projects/trackboi",
  "storagePath": ".trackboi"
}
```

Default behavior:

1. Detect or receive a project root.
2. Check configured storage candidates in order.
3. Use the first valid Trackboi database.
4. If none exists, offer to create one.
5. Store the resolved relative storage path in the project registry.

Storage should normally live inside the repo. External storage can exist later, but it weakens the git-native story and should be explicit.

## Git Integration

Git should be first-class when available.

Trackboi should detect:

- repo root
- current branch
- dirty or clean state
- possibly upstream/push status later

Core shape:

```ts
type GitContext = {
  isGitRepo: boolean;
  root: string | null;
  branch: string | null;
  dirty: boolean;
};
```

The current branch should influence the default board scope and card creation scope.

If a project is inside a git repo and a branch is available, new cards should default to the current branch scope. The user can still create global project cards intentionally.

## Scoped Work

A single global board will become noisy once multiple humans or agents work across branches. Branch scope must apply to cards and board views, not only Markdown memory files.

Trackboi stores work items globally in the database, then views them through scopes.

Initial scopes:

- project/global
- git branch

Possible future scopes:

- agent session
- milestone
- epic
- release

For v1, a card has one primary scope.

```json
{
  "scope": {
    "kind": "branch",
    "ref": "spike/tauri-shell"
  }
}
```

Project/global card:

```json
{
  "scope": {
    "kind": "project",
    "ref": "global"
  }
}
```

This keeps the model simple. Later, if the same card needs to appear in multiple scopes or boards, we can introduce multi-scope cards or separate board placements.

## Boards

Trackboi should support multiple boards per database, but this is opt-in.

For v1, there is one default board:

```txt
<storage-root>/
  boards/
    default.json
  cards/
    card_x.json
```

Cards reference their board:

```json
{
  "id": "card_x",
  "boardId": "default",
  "column": "doing",
  "rank": "V"
}
```

The UI can hide board switching while only one board exists.

### Branch Boards

A branch board is a scoped view of a board.

Near-term model:

- Cards live in `cards/`.
- Cards have `boardId`.
- Cards have `scope`.
- The board UI filters cards by selected scope.

Default scope behavior:

- If git branch exists: show current branch scope by default.
- If no git branch exists: show project/global scope.

Possible scope filters:

- Current branch
- Global project
- All cards

Later, if ordering needs to differ per scope or the same card appears in multiple views, move placement out of the card and into view files.

Possible v2 placement model:

```json
{
  "id": "branch_spike_tauri_shell",
  "kind": "branch",
  "ref": "spike/tauri-shell",
  "placements": {
    "card_x": { "column": "doing", "rank": "V" }
  }
}
```

Do not build this until one-card-one-scope becomes a real limitation.

## Cards

Cards are the basic work item.

V1 card direction:

```json
{
  "id": "card_x",
  "boardId": "default",
  "title": "Fix custom titlebar drag",
  "description": "Tauri window drag fails when permissions are missing.",
  "scope": {
    "kind": "branch",
    "ref": "spike/tauri-shell"
  },
  "parentId": null,
  "column": "doing",
  "rank": "V",
  "fields": {},
  "labels": [],
  "assignee": null,
  "createdAt": "2026-04-17T00:00:00.000Z",
  "updatedAt": "2026-04-17T00:00:00.000Z"
}
```

`column` and `rank` stay on the card for now. This is simple and git-friendly as long as a card has one primary board placement.

## Tasks And Subtasks

Trackboi should support main tasks and subtasks.

Subtasks are cards with a `parentId`.

```json
{
  "id": "card_child",
  "parentId": "card_parent"
}
```

Subtasks inherit the parent scope by default. This is important for agents because they can break down a large branch task into phases without polluting global work.

The UI can start simple:

- show child count on parent card
- show done child count later
- allow a card detail view to list children
- allow "break down into subtasks" later through MCP/agent flows

## Custom Fields

Custom fields should be project-level schema, with values stored per card.

Example project field config:

```json
{
  "fields": [
    {
      "id": "priority",
      "name": "Priority",
      "type": "select",
      "options": ["Low", "Medium", "High"]
    },
    {
      "id": "estimate",
      "name": "Estimate",
      "type": "number"
    }
  ]
}
```

Card values:

```json
{
  "fields": {
    "priority": "High",
    "estimate": 3
  }
}
```

Initial field types:

- text
- number
- checkbox
- select
- date

Avoid formulas, relations, automation rules, and rich custom types for now.

## Memory And Decisions

Branch memory and decisions are part of the larger Trackboi direction, but cards should receive branch scoping first.

Possible future storage:

```txt
<storage-root>/
  branches/
    <branch-id>/
      memory.md
      decisions.json
```

Branch names can contain slashes, spaces, and other characters. Any branch directory or file id must be encoded and store the original ref in metadata.

Decision example:

```json
{
  "id": "decision_x",
  "title": "Use Tauri instead of Electrobun",
  "reason": "Custom titlebar and resizing were unstable on Fedora.",
  "scope": {
    "kind": "branch",
    "ref": "spike/tauri-shell"
  },
  "createdAt": "2026-04-17T00:00:00.000Z"
}
```

Do not build memory and decisions before the storage resolver and scoped cards are solid.

## Data Layout Direction

Near-term target:

```txt
<repo>/
  .trackboi/                  # or .etc/.trackboi, .etc/trackboi
    project.json              # metadata, schema version, field config, storage config
    boards/
      default.json
    cards/
      card_x.json
```

Potential later layout:

```txt
<storage-root>/
  project.json
  boards/
    default.json
    release.json
  cards/
    card_x.json
  branches/
    <branch-id>/
      branch.json
      memory.md
      decisions.json
```

## Near-Term Implementation Order

1. Add storage resolver support for `.etc/.trackboi`, `.etc/trackboi`, and `.trackboi`.
2. Add `project.json` metadata inside the storage root.
3. Store each project's resolved storage path in the app registry.
4. Add git context detection.
5. Add `scope` and `boardId` to cards.
6. Default new cards to current branch scope when available.
7. Add a scope switcher in the board UI.
8. Later, add custom fields and subtasks.
9. MCP comes after core actions and storage shape stabilize.

## Open Questions

- Should v1 cards support multiple scopes, or only one primary scope?
- Should global cards appear in branch views by default?
- Should branch scope use raw branch names in card JSON, or encoded ids with a branch registry?
- What should happen when a branch is renamed?
- Should board columns be global per board, or can scoped views override columns later?
- When should placement move out of cards and into view files?
- How much git write automation should Trackboi offer, if any?
