# Trackboi — Next Features Roadmap

Date: 2026-04-17
Branch: spike/tauri-shell

This is a roadmap, not a spec. It sequences four upcoming work items and records the shared design decisions that span them. Each numbered item will get its own design spec and implementation plan when it is picked up.

## Items In Scope

1. Filewatcher refresh bug — UI does not refresh when storage files change on disk.
2. Git worktree detection — show worktrees of the current repo as sibling projects.
3. VS Code `.code-workspace` support — open a workspace file and register each folder as a project.
4. Commit message → card linking — detect card ULID refs in git log and surface linked commits on cards.

## Sequence

The order below is deliberate. Earlier items unblock or de-risk later ones.

### 1. Filewatcher refresh bug

Classification: bug investigation. Uses `systematic-debugging`, not feature design.

Why first: every other item on this list depends on the UI reflecting disk state. Worktree switching, workspace folders, and commit-link ingestion all change files on disk and expect the board to update. Fixing this first means the later features do not have to work around a broken feedback loop.

Current watcher lives in `src-tauri/src/core/watcher.rs` and emits `trackboi://project-changed` to the webview. Investigation should establish whether the event fires, whether the webview subscribes, and whether the subsequent refresh actually re-reads the snapshot.

### 2. Multi-project foundations

Classification: feature design. Shared prep for items 3 and 4.

This item does not ship a user-visible feature on its own. It exists because items 3 and 4 both add projects to the same in-memory view and both need the same discovery, registry, and removal semantics. Building this once avoids designing it twice.

Scope:

- A single in-memory model for "projects currently in view."
- A discovery API that sources and workspace-file parsers can both plug into.
- "Detach from view" without deleting the project's `.trackboi/` storage.
- A tabbed board UI that renders N projects, with one project active at a time.

### 3. Git worktree detection

Classification: feature design. Builds on item 2.

When the user opens a project inside a git repo, Trackboi runs `git worktree list` and auto-registers each worktree as a sibling project in the tabbed view. Each worktree keeps its own `.trackboi/` storage under its own working tree. Worktrees can be detached from the view without deleting their storage.

The existing `WorkScope` branch model stays unchanged; each worktree's board filters by its own current branch exactly as today.

### 4. VS Code `.code-workspace` support

Classification: feature design. Reuses the tabbed UI from item 2.

When Trackboi is opened with a `.code-workspace` file as input, it parses `folders[]` and registers each folder as a project in the tabbed view. Same registry, same detach semantics, same UI as worktrees.

This item does not require item 3 to ship first, but shipping item 3 first validates the tabbed UI against a simpler input (worktrees of one repo share git history) before adding workspace files (arbitrary folders, arbitrary repos, or no repo at all).

### 5. Commit message → card linking

Classification: feature design. Independent of items 2–4.

Trackboi scans the project's git log for card ULID references (form: `card_<ulid>`) and attaches the matching commits to the referenced card. The card detail view shows linked commits. Agents can write `card_<ulid>` into commit messages to pin commits to the card they belong to.

This item is last because it is the most self-contained and the least entangled with the UI work in items 2–4.

## Shared Decisions

These apply across items 2–4 and are recorded here so each individual spec does not relitigate them.

### Each folder is its own project

Worktrees and workspace-file folders each keep their own `.trackboi/` storage. Trackboi does not introduce a shared storage root or cross-project scope.

Why: fits the "repo-local, plain files, git-friendly" thesis in `docs/product-shape.md`. Storage boundaries stay obvious in git. Cross-project views are handled at the UI layer, not the data layer.

### Unified view is tabbed, not merged

N projects appear as N tabs in one window. Merged-board mode (one board, cards tagged with their project) is an explicit future option, not v1.

Why: tabbed matches how users already think about worktrees ("I have three branches checked out"). Merging hits column-name collisions, scope filter ambiguity, and card dedup immediately — not worth solving before a real need exists.

### Discovery is automatic, projects are removable

Worktrees of the active repo auto-register. Folders in an opened `.code-workspace` auto-register. Both can be detached from the view without deleting the underlying `.trackboi/` storage.

Why: worktrees share git history so auto-registering is low surprise. Workspace files are an explicit user signal — opening one is intent. Detach-without-delete keeps the registry from becoming sticky.

### Deduplication happens in memory, not on disk

When the same project appears through multiple discovery sources (e.g., a worktree that is also a workspace folder), Trackboi deduplicates by resolved storage path in memory. Disk layout is untouched.

## What This Document Is Not

- Not a spec. Each item gets its own `YYYY-MM-DD-<topic>-design.md` when it is picked up.
- Not a commitment to ship all four. Priorities can shift after item 1 lands.
- Not a description of file formats, IPC shapes, or API surfaces. Those live in the per-item specs.

## Next Step

Switch to `systematic-debugging` and investigate the filewatcher bug (item 1). Once that is resolved, return to brainstorming for item 2 (multi-project foundations).
