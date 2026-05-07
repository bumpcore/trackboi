---
id: "card-show-card-details-in-a-jumbo-popover-1j98reb"
boardId: "default"
title: "Show card details in a jumbo popover"
parentId: null
scope: {"kind":"project","ref":"global"}
trackId: null
column: "backlog"
rank: "j"
labels: []
assignee: null
fieldValues: {}
createdAt: "2026-05-07T11:50:23.992Z"
updatedAt: "2026-05-07T11:50:23.992Z"
createdBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
updatedBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
---
Add a quick card-detail popover so users can inspect a card without opening the full detail pane.

The desired shape is similar to VS Code hover details: clicking, hovering, or focusing a card can reveal a large popover with the card description and comments right away.

Acceptance:
- Users can quickly view a card's description and comments from the board.
- The popover is large enough to read comfortably but does not disrupt board context.
- Opening the full card detail view remains available for editing or deeper actions.
- Keyboard/focus behavior works cleanly and the popover can be dismissed predictably.