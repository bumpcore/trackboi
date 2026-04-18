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
- structured left sidebar for project, worktree, track-scope, and saved-view navigation
- central board workspace that always remains visible
- a compact active-track brief inside the workspace, above the lanes
- right inspector for the selected card

The board is the main canvas.
The inspector is the active workspace.
Track context is selected from the sidebar and summarized inside the workspace as an operational brief, not as a second competing surface.

## Region Roles

### Titlebar

The titlebar should carry:

- app identity
- current repo / branch / workspace context
- restrained global actions

It should feel compact and operational, not decorative.

### Left Sidebar

The sidebar is for navigation, not editing.

It should own:

- active project
- worktree switching
- track scope switching
- saved views
- small status cues

It should not become another dashboard.
It should also do more work through hover cards so rows can stay compact while still exposing useful context.

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
- a compact active-track brief that frames the current board context

### Right Inspector

The inspector is the primary editing surface on desktop.

It should feel like:

- a task workspace
- an issue inspector
- a context pane with structure

It should not feel like:

- a generic modal form
- stacked bordered boxes
- a long drawer full of unrelated sections

The reference uses tabs and compact sections to keep the flow readable:

- content
- activity
- context

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
- update the compact workspace brief

Track detail should then be surfaced in two places:

- a compact workspace context region above the lanes
- compact inspector context tied to the selected card

Tracks should not appear as:

- a second giant editor competing with the selected card
- a drawer with equal visual weight to the main workspace
- a noisy block of stacked fields
- hidden state that only shows up as a filter
- a separate panel that competes with the board and inspector
- a center-top strip that steals space from the board columns

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

Avoid:

- rounded pill-heavy controls
- wide loud borders
- border-heavy section boxing
- floating-card-on-card layering
- decorative or editorial typography
- purple or glassy AI styling
- overbuilt dashboard furniture

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
- switching tabs changes the inspector focus
- selecting track scope changes board context and filters the board
- switching worktrees changes visible board context
- collapsing the active-track brief keeps it available without dominating the screen
- hovering sidebar rows reveals richer tooltip cards for workspace, project, worktree, and track context

Interactions should make the tool feel alive, but not theatrical.

## What Changed From The Current App

The direction changes these assumptions:

- board editing should no longer rely on modal-first flows on desktop
- track context should no longer live in a cluttered dedicated drawer
- track context should no longer hide as minor filter chrome
- track filtering should no longer consume center workspace height when it can live beside other scope controls
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

If a future implementation choice conflicts with the reference, prefer:

1. split workspace over modal workflow
2. visible track objects over hidden track filter state
3. selected-card clarity over extra chrome
4. compact track context over a competing track panel
5. pane structure over bordered widgets
6. real task flow over showcase styling

## Reference Inputs

This direction is based on:

- `concepts/sonnet-4.6-2.html` as the primary structural reference
- `concepts/sonnet-4.6-1.html` as the moderation reference for warmth and readability
- `concepts/codex-composite-direction-2026-04-18.md` as the previous decision record that this reference refines
