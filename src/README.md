# Source Boundaries

Trackboi keeps the product source boundaries intentionally small:

- `core`: product APIs and shared models. Projects, cards, boards, storage, git/source discovery, and the rules Trackboi knows.
  Internal hierarchy:
  - `types.ts` is the domain model source of truth
  - `actions.ts` is the public nodefs-facing facade
  - `runtime.ts` is the high-level runtime assembly layer
  - `services/` holds runtime-only orchestration helpers such as aggregation, worktree discovery, and snapshot loading
- `cli`: command-line orchestration. This is where `trackboi cards`, `trackboi mcp`, and future human/agent commands live.
  Internal hierarchy:
  - `mcp.ts` bootstraps the MCP server
  - `mcp/` holds tool registration groups and shared MCP helpers
- `electron`: desktop shell glue only. Window creation, preload IPC, dialogs, watcher forwarding, and renderer adapters.
  Internal hierarchy:
  - `main.ts` assembles startup
  - `main/` holds watcher, window, and Trackboi IPC registration helpers
  - `bridge.ts`, `trackboi.ts`, and `window.ts` define renderer-facing transports
- `ui`: Vue desktop interface and local UI primitives.
  Internal hierarchy:
  - `components/` are visual building blocks
  - `composables/` own screen workflows and mutable UI state
  - `lib/` contains pure derivation and formatting helpers

Business logic should not leak into `electron` or `ui`. Those layers call `core`.
