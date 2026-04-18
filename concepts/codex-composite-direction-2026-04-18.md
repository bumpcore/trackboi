# Trackboi Composite Direction

This is the selected design direction after reviewing:

- `gemini3.1-pro.html`
- `opus-4.7.html`
- `sonnet-4.6-1.html`
- `sonnet-4.6-2.html`

This is not a pick-one winner. It is the composed direction we should build.

## The Call

Trackboi should look like a serious IDE-adjacent desktop tool.

Not:

- a SaaS dashboard
- a soft productivity toy
- a concept-shot with too much invented data
- a Trello clone with prettier cards

It should feel like:

- a local developer workstation surface
- a board + inspector tool
- something that lives next to an editor, terminal, and git client
- structured enough for humans and agents to use as shared task memory

## Final Product Feel

The target personality is:

- dense
- paneled
- practical
- inspectable
- keyboard-minded
- tweakable
- calm and technical

The app should feel more like an issue inspector inside a desktop tool than a browser form wrapped around a kanban board.

## What We Keep

### From `opus-4.7.html`

Keep:

- the strongest overall shell and desktop framing
- the command-bar centered titlebar pattern
- the denser board rhythm
- the selected-card treatment with an accent rail
- the right-side inspector mentality instead of “big floating web modal”
- the sense that the tool is built for real workflow depth

Do not keep:

- the amount of extra status chrome and invented telemetry
- the overloaded side data
- the amount of “everything at once” information density

Verdict:
This is the best structural reference, but it needs restraint.

### From `sonnet-4.6-2.html`

Keep:

- the clearest card detail panel organization
- the best split between board and editor
- the practical IBM Plex style typography direction
- the useful concept of activity / agent context / comments as part of the card workspace
- the compact, inspectable worktree and metadata language

Do not keep:

- the purple accents
- the overly explicit “tool showcase” rail content
- the feeling that every side panel must always be populated

Verdict:
Best content architecture for the card editor.

### From `sonnet-4.6-1.html`

Keep:

- the warmth and readability of the board content
- the sense that cards still have some breathing room
- the activity list tone

Do not keep:

- the serif/editorial moments
- the softer, more styled presentation language

Verdict:
Useful as a moderation layer so the final UI does not become sterile.

### From `gemini3.1-pro.html`

Keep:

- collapsible inspector sections
- simple practical interactivity cues
- the clean idea of a dedicated context panel

Do not keep:

- Inter-heavy web-app feeling
- generic panel styling
- the more browser-dashboard visual energy

Verdict:
Good interaction mechanics, weaker product identity.

## Chosen Direction

Trackboi will use:

- `opus-4.7` as the shell and board density reference
- `sonnet-4.6-2` as the card editor / detail architecture reference
- `sonnet-4.6-1` as the moderation reference for warmth and readability
- `gemini3.1-pro` only for a few collapsible interaction ideas

## Concrete UI Direction

### 1. Overall Layout

Use a true desktop three-zone layout:

- narrow icon rail
- project/worktree sidebar
- central board workspace
- docked right inspector for selected card on wide layouts

The right inspector is the main card editing experience.
Do not treat the card editor as a generic centered modal on desktop.

On smaller widths, the inspector may collapse into an overlay, but desktop is inspector-first.

### 2. Board Feel

The board should stay visible while editing.

Columns should feel like work lanes, not decorative containers:

- compact headers
- restrained borders
- limited color
- strong selected states
- clear drop targets

Cards should be compact, readable, and operational:

- title first
- short preview second
- metadata row last
- branch/worktree cues in mono
- subtle priority/state chips

Selected card state should be unmistakable.

### 3. Card Editor / Inspector

The selected card opens in a right inspector with structured sections, not a stacked form.

Required sections:

- Summary
- Notes
- Placement
- Scope / Worktree
- Fields
- Subtasks
- Activity / Comments
- Agent Context
- Technical Metadata

The inspector should feel like a mix of:

- issue editor
- file inspector
- task context pane

Not like:

- a CRUD form
- a marketing modal
- a docs page embedded in a dialog

### 4. Comments / Activity

We should adopt comments.

Not as realtime chat.
As local, persistent task context.

Comments should live in the card inspector as part of an `Activity` or `Comments` section and support:

- human notes
- agent notes
- handoff context
- progress breadcrumbs
- future “why this changed” memory

This is one of the strongest ideas surfaced by the concepts and fits Trackboi extremely well.

The important product framing:

- comments are contextual task memory
- comments are not team-chat theater
- comments help the next human or agent pick up work with more depth

### 5. Typography

Use practical UI typography only.

Approved style:

- system or pragmatic sans-serif for main UI
- monospace for technical context, IDs, branches, storage paths, chips, compact metadata

Do not use:

- editorial serif accents
- stylish display fonts
- branding-heavy type treatments

### 6. Visual Language

Use:

- dark professional neutral base
- restrained amber or warm accent as the primary highlight
- muted greens/blues only where functional
- strong separators and panel boundaries
- low-radius surfaces
- subtle glow only where it indicates state

Avoid:

- purple AI styling
- candy accents
- heavy gradients
- glossy “concept shot” styling

## Final Design Rules

If a future UI choice conflicts with these, prefer these rules:

1. Desktop tool over web app.
2. Inspector over modal.
3. Structure over decoration.
4. Selection clarity over hover flair.
5. Context depth over fake dashboard noise.
6. Practical typography over stylish typography.
7. Comments/activity as task memory, not social feed.

## Build North Star

If we were to describe the final result in one line:

Trackboi should feel like a local-first engineering task board with a real inspector, real context memory, and enough structure that both humans and agents can work from it without asking the same questions twice.
