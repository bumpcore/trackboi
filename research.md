# Trackboi Desktop Shell Research

Date: 2026-04-16

## Context

Trackboi is a local-first Kanban desktop app for repos. Board state lives in `.trackboi` JSON files inside user projects. The app needs:

- Vue 3 UI
- polished custom chrome/titlebar
- reliable resize behavior on Fedora/Linux
- native folder picker
- filesystem read/write/watch
- small-ish desktop footprint
- eventually an MCP server or sidecar

Electrobun proved the product idea quickly, but custom chrome on Linux/Fedora is currently too fragile: hidden titlebar removes resize corners, hidden inset still shows native chrome, and an upstream issue for this area appears to be unanswered.

## Summary Recommendation

Short version: **try Tauri v2 next, but do it as a spike, not a full rewrite yet.**

Tauri is the best fit for Trackboi's values: local-first, small, web UI, native shell, sidecars, filesystem plugins, and a much larger ecosystem than Electrobun. The Rust concern is real, but Trackboi can structure the app so Rust stays thin: window shell, dialogs, permissions, and maybe sidecar launching. The product logic can remain TypeScript for now.

If Tauri custom chrome is also painful on Fedora, the boring fallback is **Electron**. Electron is heavier, but its custom titlebar and Linux window behavior are much more documented and battle-tested.

## Ranked Options

## 1. Tauri v2

Best overall candidate.

### Why It Fits

- First-class Vue/Vite workflow.
- Custom titlebar/chrome is an explicit documented use case.
- Native dialog plugin supports directory picking.
- Filesystem plugin supports read/write and file watching.
- Shell plugin supports sidecars, including bundled external binaries.
- Smaller footprint than Electron.
- Larger ecosystem and issue velocity than Electrobun.

### Rust Risk

This is the main concern.

Tauri uses Rust for backend commands and app shell behavior. The docs show the command model: annotate Rust functions with `#[tauri::command]`, register them, and call them from JS with `invoke()`.

That means we would need some Rust, but not necessarily much. A low-Rust Trackboi architecture could be:

- Vue/TypeScript owns UI and most board logic initially.
- Tauri plugins handle dialog/fs/watch from JS.
- Rust only wires app setup and permissions.
- Later, if needed, a Bun/Node sidecar can own the MCP server.

This makes Tauri less scary than "rewrite Trackboi in Rust." It is more like "accept a Rust config and command shell."

### Window Chrome

Tauri documents custom titlebar/window customization, but there are historical issues around custom titlebars and resizing when decorations are disabled. This is exactly why the first Tauri task should be a **Fedora custom-titlebar resize spike** before migrating anything else.

Pass criteria for spike:

- hidden native titlebar
- custom draggable titlebar
- double-click maximize
- native or framework-supported resizing from all edges/corners
- works on your Fedora session
- main area scrolls without moving sidebars/titlebar

### MCP Story

Good. Tauri sidecars can bundle an external binary. That means a future MCP server could be:

- a Rust command/server
- a Bun-compiled binary
- a Node sidecar packaged as a binary
- a separate CLI users configure manually

### Gotchas

- Permissions/capabilities are more explicit than Electrobun.
- Rust compile/toolchain setup is required.
- File access is permission-scoped.
- You should avoid putting product logic into Rust until you are comfortable.

### Verdict

Best next spike. Do not fully migrate until custom chrome/resize passes on Fedora.

## 2. Electron

Most reliable fallback.

### Why It Fits

- Excellent Vue/Vite support.
- Custom titlebar is deeply documented.
- On Windows/Linux, Electron supports `titleBarStyle: "hidden"` plus `titleBarOverlay`.
- Drag regions use `app-region: drag`.
- Huge ecosystem.
- File system, watchers, child processes, and MCP sidecars are straightforward in Node.

### Why Not

- Large runtime footprint.
- Bundles Chromium.
- Feels less aligned with the "tiny local app" taste.

### Practical Note

If the priority becomes "custom chrome must work and I want to stay in TypeScript," Electron is the safest choice. It lets us keep almost everything in TypeScript and avoids the Rust fear entirely.

### Verdict

The boring reliable option. Use if Tauri spike fails or Rust friction feels too high.

## 3. Wails

Interesting, but less ideal than Tauri/Electron right now.

### Why It Fits

- Uses web UI with a native Go shell.
- Wails v3 docs explicitly discuss frameless windows, drag regions, system buttons, and CSS-based resize handles.
- Go may be easier to vibe-code than Rust for some people.

### Why Not

- Wails v3 is alpha/newer.
- Smaller ecosystem than Tauri and Electron.
- We would still introduce a second backend language.
- The current stable Wails docs and v3 alpha docs differ, so the migration target needs care.

### Verdict

Worth watching. Not my first pick unless you prefer Go over Rust enough that this changes the risk profile.

## 4. Neutralinojs

Small and simple, but likely too limited.

### Why It Fits

- Very small footprint.
- Has filesystem APIs.
- Has window APIs including borderless and draggable regions.

### Why Not

- Less mature for a polished desktop app with complex custom chrome.
- Smaller ecosystem and fewer examples for serious app architecture.
- Future MCP/server story is less obvious than Tauri/Electron.

### Verdict

Good for tiny utilities. Trackboi likely wants a stronger shell.

## 5. Flutter Desktop

Powerful, but wrong migration shape.

### Why It Fits

- Desktop support is real.
- Packages like `bitsdojo_window` support custom window frames on Windows/macOS/Linux.
- Good native-feeling UI potential.

### Why Not

- We would rewrite the UI from Vue to Flutter/Dart.
- Existing Tailwind/shadcn/Vue work is not portable.
- More of a product rewrite than a shell migration.

### Verdict

Not a good fit unless we intentionally abandon the web UI approach.

## Recommended Migration Strategy

Do not rewrite yet. Create a **Tauri spike branch**.

### Spike Scope

1. Scaffold Tauri v2 + Vue.
2. Port only the current static shell UI, not all storage logic.
3. Implement custom titlebar.
4. Test Fedora resize from every edge/corner.
5. Test folder picker.
6. Test reading/writing a `.trackboi/board.json`.
7. Test file watching.
8. Test launching a sidecar or at least confirm sidecar config.

### Pass Criteria

Tauri is worth migrating if:

- custom chrome works on Fedora
- resize works naturally
- Vue dev loop feels okay
- folder picker and fs/watch are straightforward
- Rust stays thin and understandable

### Fail Criteria

Switch to Electron if:

- Tauri custom chrome has the same resize problems
- Rust setup starts eating product time
- permission config becomes a constant papercut
- dev loop feels slow or brittle

## Rust Fear Assessment

The fear is valid, but manageable if we set rules:

- No product logic in Rust at first.
- Rust files should stay tiny.
- Every Rust command should be boring: input, call plugin/std lib, return JSON.
- Prefer Tauri JS plugins where possible.
- Use sidecars for MCP rather than embedding MCP complexity in Rust.
- Treat Rust as app-shell glue, not the app.

If that still feels uncomfortable after a spike, Electron is the right choice. There is no shame in choosing the tool that keeps you shipping.

## Current Best Bet

My current recommendation:

1. Finish one or two more UX slices in Electrobun if we want momentum.
2. Then create a Tauri spike branch before the codebase grows.
3. If the spike passes, migrate.
4. If the spike fails, go Electron.

## Sources

- Electrobun BrowserWindow docs: https://blackboard.sh/electrobun/docs/apis/browser-window/
- Electrobun BrowserView docs: https://blackboard.sh/electrobun/docs/apis/browser-view/
- Tauri window customization: https://v2.tauri.app/learn/window-customization/
- Tauri commands / calling Rust from frontend: https://v2.tauri.app/develop/calling-rust/
- Tauri filesystem plugin and watch APIs: https://v2.tauri.app/plugin/file-system/
- Tauri dialog plugin: https://v2.tauri.app/reference/javascript/dialog/
- Tauri shell sidecar reference: https://v2.tauri.app/reference/javascript/shell/
- Tauri sidecar guide: https://tauri.app/develop/sidecar/
- Tauri Node.js sidecar guide: https://v2.tauri.app/learn/sidecar-nodejs/
- Electron custom titlebar docs: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
- Wails frameless windows docs: https://v3alpha.wails.io/features/windows/frameless/
- Wails window options: https://wails.io/docs/reference/options
- Neutralino filesystem API: https://neutralino.js.org/docs/api/filesystem/
- Neutralino window API: https://neutralino.js.org/docs/api/window/
- Flutter bitsdojo_window package: https://github.com/bitsdojo/bitsdojo_window

