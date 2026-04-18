# Trackboi Sonnet Reference

This document records the intended direction for the standalone reference in [codex-sonnet-reference-2026-04-18.html](./codex-sonnet-reference-2026-04-18.html) so future implementation work does not drift back into the current UI problems.

## Product Feel

Trackboi should feel like a serious desktop tool that lives beside an editor, terminal, and git client.

The target feel is:

- calm
- structured
- interactive
- dense enough for real work
- technical without becoming cold
- more like an inspector workspace than a stack of forms

This is not:

- a SaaS dashboard
- a Trello clone with nicer borders
- a center-modal CRUD app
- a concept shot with invented telemetry

## Layout Hierarchy

The reference uses a split workspace:

- frameless titlebar with compact repo and branch context
- narrow icon rail for tool-level navigation
- collapsible and resizable left panel that changes views from the icon rail
- central board workspace that always remains visible
- collapsible and resizable right panel that hosts multiple inspector views

The side panels should work more like VS Code:

- panels are containers for views, not fixed-purpose drawers
- the rail decides what content a panel is showing
- the board should keep the center, even while panels switch subjects
- card and track can both remain available as pinned views in the right panel
- resize affordance should live on the separating border, not in a chunky visible handle
- collapsed panels should not pop open instantly on drag; they should stay collapsed until the drag crosses a deliberate reopen threshold
- expanded panels should also be able to collapse just by being resized back below a collapse threshold

The board is the main canvas.
The inspector is the active workspace.
Track context is selected from the sidebar and given a dedicated inspector view, not a second competing surface above the lanes.

## Region Roles

### Titlebar

The titlebar should carry:

- app identity
- current repo / branch / workspace context
- restrained global actions

It should feel compact and operational, not decorative.

### Left Panel

The left side is a view container for navigation-oriented content.

It should own:

- active project
- worktree switching
- track scope as its own switchable panel view
- saved views as their own switchable panel view
- agent-oriented side information when requested
- small status cues

It should not become another dashboard.
It should also do more work through hover cards so rows can stay compact while still exposing useful context.
It should be:

- collapsible
- resizable
- switchable from the left rail
- precise enough to disappear when the board needs space

### Board Workspace

The board should remain visible while details are being inspected.

Board lanes should feel like work regions with contained card objects, not loose content floating in columns.
Cards should read as compact framed panels:

- title
- short preview
- track/worktree cue
- progress / metadata

Selection should be obvious.
Hover should feel responsive.
The board should not disappear behind an editing flow.

Tracks also belong to the board workspace.
They should not be hidden as tiny filter state.
The primary track representation is:

- a dedicated sidebar scope section beside worktrees
- one active track at a time
- an `All Work` scope for global and untracked board state
- a dedicated `Track` subject mode in the right inspector

### Right Panel

The right side is the primary editing surface on desktop, but it should behave like a panel of views rather than one locked inspector.

It should feel like:

- a task workspace
- an issue inspector
- a context pane with structure
- a place where card, track, activity, and context can be switched without losing the previous subject

It should not feel like:

- a generic modal form
- stacked bordered boxes
- a long drawer full of unrelated sections
- a panel dedicated to only one content type forever

The reference uses:

- a top-mounted view switcher when the panel is expanded
- a compact icon strip when the panel is collapsed
- pinned `Card` and `Track` views
- additional `Activity` and `Context` views
- compact sections inside the active view
- collapse and resize behavior so the board can reclaim space

## Track Direction

Tracks remain first-class, but their presentation changes.

We are explicitly moving away from both:

- the cluttered dedicated track drawer
- track-as-chip-only treatment

Tracks should appear as visible workspace scope objects.
The primary representation is a dedicated `Track Scope` section in the left sidebar, adjacent to worktrees and views.

Each track object should communicate:

- title
- source or branch cue
- one-line goal
- linked card count
- richer context through hover cards rather than always-on clutter

Selecting a track should:

- change board context
- filter the board to that track by default
- keep the active track visibly selected in the sidebar
- make the active track available as a pinned right-panel view

Track detail should then be surfaced in two places:

- the right panel in `Track` view
- compact inline track context when the right panel is in `Card` view

Tracks should not appear as:

- a second giant editor competing with the selected card
- a drawer with equal visual weight to the main workspace
- a noisy block of stacked fields
- hidden state that only shows up as a filter
- a separate panel that competes with the board and inspector
- a center-top strip that steals space from the board columns
- a dedicated board-region block above the lanes

The card remains the main active unit.
The track is the work container and narrative around it.

## Visual Rules

The reference intentionally rejects the current noisy treatment.

Use:

- low-radius geometry across the full screen
- thin separators
- tonal contrast between panes
- inset surfaces
- compact scope rows in the sidebar
- framed cards with restrained borders
- full-frame selection with one precise accent cue
- restrained warm accenting
- pragmatic sans for UI
- mono only for technical labels and metadata
- richer tooltip cards to expose extra context without permanent noise
- border-based resize affordances that only light up on hover/drag
- resize highlight should stay inside the Trackboi accent palette, not introduce foreign blue UI
- fixed-width board lanes with horizontal scrolling instead of stretchy columns

Avoid:

- rounded pill-heavy controls
- wide loud borders
- border-heavy section boxing
- floating-card-on-card layering
- decorative or editorial typography
- purple or glassy AI styling
- overbuilt dashboard furniture
- permanent visible resize gutters
- columns that stretch and compress with panel width changes

Hierarchy should come from:

- spacing
- tone
- selection state
- typography
- subtle emphasis color

not from heavy outlines.

## Interaction Rules

The reference demonstrates many interactions, but all in one coherent workflow:

- selecting a card updates the inspector
- selecting a track updates board scope and the pinned track view
- switching left-panel views changes what the sidebar is showing
- switching right-panel views changes which inspector surface is active
- selecting track scope changes board context and filters the board
- switching worktrees changes visible board context
- collapsing and resizing the side panels changes how much space the board gets
- hovering the panel borders should hint at resize only when needed
- hovering sidebar rows reveals richer tooltip cards for workspace, project, worktree, and track context

Interactions should make the tool feel alive, but not theatrical.

## What Changed From The Current App

The direction changes these assumptions:

- board editing should no longer rely on modal-first flows on desktop
- track context should no longer live in a cluttered dedicated drawer
- track context should no longer hide as minor filter chrome
- track filtering should no longer consume center workspace height when it can live beside other scope controls
- track detail should no longer sit above the board as a competing content block
- the left and right edges should no longer be treated as single-purpose surfaces
- side panels should become collapsible, resizable view containers
- the inspector view switcher should no longer read like a vertical mini-sidebar when the panel is open
- the board background should no longer rely on gradients or decorative framing
- borders should no longer do most of the layout work
- the left side should no longer feel softer or rounder than the rest of the app
- comments/activity should feel like usable task memory, not a bolted-on log
- the selected card should feel like a real working surface, not a form with sections
- active elements should not rely on thickened left-edge borders as the primary emphasis

## Anti-Regression Rules

Future implementation should not regress into:

- stacked forms
- oversized borders
- floating web-modal feel
- noisy drawer clutter
- track-as-chip-only
- track-as-hidden-context
- track-as-heavy-drawer
- disconnected card and track experiences
- fixed-purpose sidebars that cannot switch views
- side panels that cannot collapse or resize

If a future implementation choice conflicts with the reference, prefer:

1. split workspace over modal workflow
2. panel view containers over single-purpose drawers
3. visible track objects over hidden track filter state
4. selected-card clarity over extra chrome
5. compact track context over a competing track panel
6. pane structure over bordered widgets
7. real task flow over showcase styling

## Reference Inputs

This direction is based on:

- `concepts/sonnet-4.6-2.html` as the primary structural reference
- `concepts/sonnet-4.6-1.html` as the moderation reference for warmth and readability
- `concepts/codex-composite-direction-2026-04-18.md` as the previous decision record that this reference refines
