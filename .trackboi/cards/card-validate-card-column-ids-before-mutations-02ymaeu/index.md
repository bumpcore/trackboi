---
id: "card-validate-card-column-ids-before-mutations-02ymaeu"
boardId: "default"
title: "Validate card column ids before mutations"
parentId: null
scope: {"kind":"project","ref":"global"}
trackId: null
column: "done"
rank: "j"
labels: []
assignee: null
fieldValues: {}
createdAt: "2026-05-07T11:33:29.561Z"
updatedAt: "2026-05-08T18:40:51.005Z"
createdBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Prevent cards from being created or moved into stray column values that are not part of the board shape.

Context: a batch was moved into a stray `review` column value while the real Review lane id was `ready`, so the UI only showed cards that were actually in `ready`.

Acceptance:
- `create_card`, `update_card`, and `move_card` reject unknown column ids with a clear error.
- Validation uses the target board's current column ids, not display names or guessed aliases.
- Existing cards with invalid column values are surfaced or recoverable instead of silently disappearing from the UI.