# Source Boundaries

Trackboi keeps the frontend source boundaries here and the backend boundary in `src-tauri/src`.

- `core`: TypeScript contracts consumed by the UI. Rust is the source of backend behavior.
- `ui`: desktop user interface.
- `platform`: frontend runtime adapters such as Tauri command/window/dialog calls.

The Rust backend currently owns product storage/actions in `src-tauri/src/core/` and the MCP binary entry path in `src-tauri/src/mcp.rs`.
