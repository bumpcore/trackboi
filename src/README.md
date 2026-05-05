# Source Boundaries

trackboi keeps the product source boundaries intentionally small:

- `core`: product APIs and shared models. Projects, cards, boards, storage, git/source discovery, and the rules trackboi knows.
  Internal hierarchy:
  - `types.ts` is the domain model source of truth
  - `actions.ts` is the public nodefs-facing facade
  - `runtime.ts` is the high-level runtime assembly layer
  - `services/` holds runtime-only orchestration helpers such as aggregation, worktree discovery, and snapshot loading
- `cli`: command-line orchestration. This is where `trackboi install` and `trackboi mcp` live.
  Internal hierarchy:
  - `mcp.ts` bootstraps the MCP server
  - `mcp/` holds tool registration groups and shared MCP helpers
- `electron`: desktop shell glue only. Window creation, preload IPC, dialogs, watcher forwarding, and renderer adapters.
  Internal hierarchy:
  - `main.ts` assembles startup
  - `main/` holds watcher, window, and trackboi IPC registration helpers
  - `bridge.ts`, `trackboi.ts`, and `window.ts` define renderer-facing transports
- `ui`: Vue desktop interface and local UI primitives.
  Internal hierarchy:
  - `components/` are visual building blocks
  - `composables/` own screen workflows and mutable UI state
  - `lib/` contains pure derivation and formatting helpers

Business logic should not leak into `electron` or `ui`. Those layers call `core`.

## Product Model

trackboi's working hierarchy is:

- `Workspace`: a user-registered repo/folder
- `Worktree`: a discovered workspace variant with its own filesystem-backed state
- `Project`: the per-worktree project definition and identity
- `Board`: a first-class board inside that worktree project
- `Track`: a project-wide work container that can link cards across boards
- `Task/Card`: a board-scoped work item

The active worktree is the current workspace context. Switching worktrees replaces
the effective project, board, track, and card universe instead of filtering one
merged multi-worktree snapshot.

Board custom fields are board-scoped. Project settings are reserved for
project-wide configuration inside the active worktree, such as people aliases
and future agent or workflow configuration.
