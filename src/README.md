# Source Boundaries

Trackboi keeps the product source boundaries intentionally small:

- `core`: product APIs and shared models. Projects, cards, boards, storage, git/source discovery, and the rules Trackboi knows.
- `cli`: command-line orchestration. This is where `trackboi cards`, `trackboi mcp`, and future human/agent commands live.
- `electron`: desktop shell glue only. Window creation, preload IPC, dialogs, watcher forwarding, and renderer adapters.
- `ui`: Vue desktop interface and local UI primitives.

Business logic should not leak into `electron` or `ui`. Those layers call `core`.
