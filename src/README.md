# Source Boundaries

Trackboi keeps the product source boundaries here. The desktop shell is Electron, with
the main process under `src/electron`.

- `core`: TypeScript contracts consumed by the UI and Electron bridge.
- `ui`: desktop user interface.
- `platform`: frontend runtime adapters such as Electron IPC/window/dialog calls.

The Electron main process currently owns local filesystem access, git probing,
project discovery, and card/board mutations.
