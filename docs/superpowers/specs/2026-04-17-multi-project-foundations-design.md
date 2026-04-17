# Multi-Project Foundations — Design

Date: 2026-04-17
Branch: desktop-shell
Roadmap item: #2 of [next-features-roadmap](2026-04-17-next-features-roadmap.md)

## Goal

Establish the data model, discovery API, and sidebar UI that item 3 (git worktree detection) and item 4 (VS Code `.code-workspace` support) will plug into. This item ships no new user-visible feature beyond a refactored sidebar — it is scaffolding.

## Non-goals

- No actual worktree or workspace-file discovery (items 3 and 4).
- No multi-project file watching (only the active project is watched).
- No merged board view across projects.
- No per-project data model changes — cards, boards, scopes stay exactly as they are.

## Shared Decisions (carried from roadmap)

- Each folder is its own project with its own `.trackboi/` storage.
- View is unified, single-project-active, sidebar-grouped (no tab strip).
- Manual registry entries persist; discovered entries are ephemeral (hybrid model).
- Dedup across sources by canonical storage path.

## Data Model

Three source-oriented types replace the early flat project list.

```ts
type ProjectSourceKind =
	| { kind: "manual" }
	| { kind: "gitWorktrees"; repoRoot: string }
	| { kind: "codeWorkspace"; filePath: string };

type ProjectSource = ProjectSourceKind & {
	id: string;
	label: string;
	entries: ProjectEntry[];
}

type ProjectEntry = {
	projectId: string;
	name: string;
	path: string;        // canonical absolute
	storagePath?: string;
	status: ProjectStatus;
}

type ProjectView = {
	sources: ProjectSource[];
	activeProjectId: string | null;
	storageSearchPaths: string[];
}
```

- `project_id` for manual entries is the existing registry id. For discovered entries it is deterministic from the canonical path so that the id is stable across view refreshes.
- `ProjectView` replaces `ProjectIndex` in IPC payloads and frontend state.

## Discovery API

Each source is assembled by a small provider function:

```ts
type ProjectSourceProvider = (context: ProjectSourceContext) => ProjectSource | null;

type ProjectSourceContext = {
	registry: ProjectRegistry;
	activeProjectPath: string | null;
};
```

The view assembler runs each registered provider, collects their entries, deduplicates by canonical storage path (first-seen wins), and returns a `ProjectView`.

Item 2 registers exactly one provider: `ManualRegistry`, which emits the current persistent registry entries.

Items 3 and 4 will add `GitWorktrees` and `CodeWorkspace` providers. Neither is implemented here.

## Persistence

- Manual entries: persisted in the existing app-config registry. No schema change.
- Discovered entries: never persisted. Computed on every `list_view` call.

Dedup rule: when a discovered entry has the same canonical storage path as a manual entry, the manual entry wins and the discovered one is silently dropped. This prevents duplicate rendering when a user has manually added a folder that a future source would also detect.

## IPC Surface

- New command: `list_view() -> ProjectView`. Replaces `list_project_index`.
- `switch_project(project_id)` unchanged.
- `choose_project(project_path)` unchanged — still adds to the manual registry.
- `remove_project(project_id)` continues to remove only manual entries. Called on a discovered entry's id, it returns an error with a message that points at the owning source (relevant once items 3/4 land; for item 2 the error is unreachable because the only source is Manual).

Old `list_project_index` is removed. No compatibility shim — the registry format on disk does not change, only the IPC surface.

## Sidebar UI

The current sidebar renders a flat project list. It becomes a list of sections, one per source.

Rendering rules:

- Zero sources: show the empty-state "Open a project" flow that exists today.
- One source: render entries as a flat list under no header (preserves current visual for item 2 alone).
- Two or more sources: render each source as a section with its `label` as a header and its entries beneath.

A single active project indicator (highlight) persists, regardless of source count. Clicking an entry calls `switch_project`.

The sidebar's existing affordances (locate missing, remove, "+ Open…", storage search paths) remain. "Remove" is enabled only on manual entries; for discovered entries it is hidden.

## Storage Watcher

No change. The watcher still attaches to the single active project's storage root. Multi-project watching is explicitly out of scope until a scenario needs it.

## Error Handling

- A source provider that panics or returns an error is logged and its section is rendered empty. One bad source cannot block the view.
- A discovered entry whose path does not exist at view time is emitted with `status = missing`, same as manual entries.

## Testing

Unit tests (Rust) for the view assembler:

- Empty sources → empty view.
- Single source → entries passed through untouched.
- Two sources, disjoint paths → both sets appear.
- Two sources, overlapping paths → first-seen wins.
- Provider error → source section present but empty.

No integration tests for item 2 alone; items 3 and 4 add their own source-specific tests.

## Migration

None. The on-disk registry schema is unchanged. Only in-memory types and IPC shape change.

## Open Questions Deferred to Items 3/4

- How a discovered source is activated (e.g., when does `GitWorktrees` run: on app open, on active-project change, both?).
- How a user dismisses a discovered entry they want to hide.
- Whether the watcher needs to follow the active project across source changes.

These do not block item 2 because item 2 ships with only `ManualRegistry`, whose behavior is fully defined.
