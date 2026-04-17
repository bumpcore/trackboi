# Trackboi Implementation Plan

Trackboi is a local-first desktop workspace for repo-bound work. The Kanban board is the first surface, but the product should grow into a small, opinionated context system for humans and agents working inside git repositories.

## Current Bias

Build the desktop UX first. MCP arrives after the core app feels worth using by hand.

## Phase 1: UI System Baseline

Goal: every primitive in the app should feel like Trackboi, not like a browser form.

- Replace native-looking selects with a real app dropdown.
- Add app-native confirm dialogs before destructive actions.
- Add a proper card detail sheet.
- Standardize field labels, help text, empty states, and error states.
- Keep sidebar/titlebar/main-scroll behavior stable while the board grows.

## Phase 2: Storage Shape

Goal: make the repo-local data model boring, inspectable, and ready for bigger features.

- Resolve existing storage roots in this order by default: `.trackboi`, `.etc/.trackboi`, `.etc/trackboi`.
- For new storage, use `.etc/.trackboi` when the project already has a `.etc` directory; otherwise use `.trackboi`.
- Keep storage roots configurable per app install.
- Move toward a directory shape that can support multiple boards:
  - `project.json`
  - `boards/default.json`
  - `cards/*.json`
  - later: `contexts/`, `decisions/`, `fields/`
- Keep JSON for now. Revisit markdown/frontmatter only after the model is proven.

Current rule:

- Store the active board at `boards/default.json`.
- Do not carry a legacy `board.json` compatibility layer until real users need migration.

## Phase 3: Git And Scope

Goal: make Trackboi useful in real branch work, where a single global board would become noise.

- Detect current git branch.
- Default new cards to current branch when available.
- Allow global project cards for work that should not belong to a branch.
- Filter the board by all cards, current branch, or global cards.
- Store scope on cards, not just markdown notes.

## Phase 4: Board And Cards

Goal: make the first board workflow complete enough to dogfood.

- Rename the board and manage columns from project settings.
- Create, edit, delete, and move cards.
- Edit scope, title, description, and column.
- Preserve rank-based ordering.
- Add keyboard-friendly, stable interactions.
- Add a focused empty-state flow for branch-scoped boards.

## Phase 5: Task Hierarchy

Goal: give agents and humans a way to split work without exploding the board.

- Add `parentId` for subtasks.
- Show child counts on parent cards.
- Let subtasks inherit scope by default.
- Add a focused view for a parent task and its phases.

## Phase 6: Custom Fields

Goal: stay flexible without becoming Jira cosplay.

- Add project-defined fields for cards.
- Start with text, number, checkbox, select, and date.
- Keep field definitions repo-local and diffable.
- Keep field UI compact and optional.

## Phase 7: MCP

Goal: expose the same core actions to agents after the desktop product shape settles.

- Keep MCP tools mapped to core app operations.
- Avoid separate write paths.
- Start with projects, boards, cards, moves, scopes, and task hierarchy.
- Add context/decision tools after those concepts exist in the app.

## Near-Term Cut

1. Replace browser-native selects with Trackboi dropdowns.
2. Replace `window.confirm` with an app dialog.
3. Tighten card edit sheet and branch-scope copy.
4. Move storage shape toward `project.json`, `boards/default.json`, `cards/*.json`.
