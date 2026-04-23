# Trackboi Agent Guide

Trackboi is organized around a small set of hard boundaries:

- `core`: product rules, storage, snapshot aggregation, and the public Trackboi actions/runtime APIs.
- `electron`: shell glue, bridge contracts, IPC wiring, watcher forwarding, and desktop-specific adapters only.
- `ui`: Vue components, workflow composables, view-model derivation, and presentation helpers.
- `cli`: command orchestration and MCP transport over the same core actions used by desktop.

If a change makes those boundaries blur, stop and reshape it before adding more code.

## Trackboi Skill

Agents working in this repository should load `.agents/skills/trackboi/SKILL.md` when work is non-trivial, stateful, or useful to track beyond the current chat. Use Trackboi MCP tools when available to orient, choose the active project/worktree/board, update cards, and leave handoff notes.

## Product Terms

Use these words consistently:

- `Workspace`: a user-registered repo/folder entry.
- `Worktree`: a discovered workspace variant. It is not a separate user-added workspace, but it has explicit identity because filesystem-backed state can differ or lag there.
- `Project`: the per-worktree project definition and identity. It owns project-scoped settings such as people aliases and future agent/workflow config.
- `Board`: a first-class board inside a worktree project.
- `Track`: a project-wide work container for intent, brief, files, decisions, references, and linked tasks.
- `Task` / `Card`: a board-scoped work item that can optionally link to a track.

Hierarchy:

- `workspace -> worktree -> project -> track`
- `workspace -> worktree -> project -> board -> task`

## Layer Rules

### `core`

Allowed:

- file layout and storage rules
- snapshot aggregation
- git/worktree discovery
- card and track mutation rules
- compatibility helpers and cache policy

Not allowed:

- Electron APIs
- Vue refs/components/templates
- browser window state

Good shape:

```ts
/**
 * Resolves a synthetic branch-backed track into a real persisted track the
 * first time a write path needs a durable id.
 */
function materializeBranchTrack(ref: string, title = ref): Track {
	// core compatibility rule here
}
```

Bad shape:

```ts
function materializeBranchTrack(ref: string) {
	window.alert(ref);
}
```

### `electron`

Allowed:

- dialog integration
- BrowserWindow lifecycle
- IPC registration
- renderer/main bridge contracts
- debounce/refresh helpers around desktop events

Not allowed:

- business rules for cards, tracks, or storage
- direct UI-state logic

Good shape:

```ts
/**
 * Refreshes renderer listeners after a filesystem-triggered project change.
 */
async function notifyBoardChanged() {
	const snapshot = await trackboiApi.getActiveProject();
	for (const listener of listeners) listener(snapshot);
}
```

### `ui`

Allowed:

- screen workflow state in `useX` composables
- presentational components in `components/`
- pure derivation helpers in `ui/lib`

Not allowed:

- storage writes that bypass the desktop facade
- shell logic in SFC templates
- giant “everything” screen files

Good shape:

```ts
/**
 * Coordinates new-card and edit-card workflows without letting the app shell
 * accumulate every modal field and mutation pathway.
 */
export function useCardWorkflow(/* ... */) {
	// modal and mutation workflow only
}
```

Bad shape:

```vue
<script setup lang="ts">
// board filtering, project switching, storage paths, edit modal state,
// track file writes, and custom field config all mixed together
</script>
```

### `cli`

Allowed:

- command parsing
- MCP bootstrap
- tool registration groups

Not allowed:

- reimplementing runtime rules already present in `core`

Good shape:

```ts
export async function runMcpServer(trackboi: NodeFsTrackboiActions): Promise<void> {
	registerProjectTools(server, trackboi);
	registerBoardTools(server, trackboi);
	registerCardTools(server, trackboi);
	registerTrackTools(server, trackboi);
}
```

## How To Choose A Home

- `component`: mostly template/presentation and local UI interactions.
- `composable`: a screen workflow with refs, computeds, and actions.
- `ui/lib` helper: pure derivation/formatting with no side effects.
- `service`: internal core logic that coordinates one domain concern.
- `adapter`: bridges one layer/transport to another.
- `facade`: the stable public entrypoint over a deeper subsystem.

If a file owns multiple workflows, split it.
If a file owns both orchestration and low-level helpers, split it.
If a file crosses two top-level layers, move the crossing logic into an adapter/facade.

## Docblocks And Comments

Add docblocks to:

- exported functions
- exported types/interfaces with product meaning
- composables
- orchestration helpers
- cache/merge/compatibility helpers

Add inline comments only when the code would otherwise hide:

- cache invalidation reasons
- ordering constraints
- compatibility behavior
- transport-specific quirks

Do not narrate obvious assignments.

Good:

```ts
// The selected worktree can disappear after a project refresh, so clear the filter
// before the board asks for a now-invalid scoped view.
if (worktreeFilterId.value && !nextState.worktrees.some((worktree) => worktree.id === worktreeFilterId.value)) {
	worktreeFilterId.value = null;
}
```

Bad:

```ts
// Set the loading flag to true.
loading.value = true;
```

## Naming Rules

- `useX` for UI workflow/state composition
- `createX` for factories and facades
- `read/list/get/update/delete` for core operations
- `helpers` only for small, low-level shared utilities
- `service` only when the module owns a real domain/process concern

Prefer names that reveal responsibility:

- `useDesktopProjectState`
- `useTrackWorkflow`
- `registerCardTools`
- `withProject`

Avoid vague buckets:

- `misc.ts`
- `sharedStuff.ts`
- `helpers.ts` that hides business logic

## Extraction Heuristics

Split a file when it has:

- multiple distinct workflows
- multiple data domains
- both orchestration and pure helpers
- both transport and business logic
- more than one major reason to change

Current examples:

- `src/ui/App.vue` should stay a screen composer, not the owner of every workflow.
- `src/core/runtime.ts` should read as a facade over snapshot/discovery/mutation services.
- `src/cli/mcp.ts` should stay a bootstrap file, with tool groups living beside it.

## Anti-Patterns

Do not add:

- business rules inside Vue components
- Electron-specific logic in `core`
- filesystem writes in `ui`
- giant adapter files that both register transport and implement business logic
- passive “TODO refactor later” comments instead of extracting now

When in doubt, make the code smaller, more explicit, and easier to read in isolation.
