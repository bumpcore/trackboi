---
id: "card-remove-scope-from-cards-12vkmvg"
boardId: "default"
title: "Remove scope from cards"
parentId: null
scope: {"kind":"project","ref":"global"}
trackId: null
column: "done"
rank: "j"
labels: []
assignee: null
fieldValues: {}
createdAt: "2026-05-07T11:33:54.821Z"
updatedAt: "2026-05-08T19:08:04.956Z"
createdBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Remove the `scope` field from cards because it no longer provides useful behavior and has effectively been replaced by tracks.

Acceptance:
- Card storage/schema no longer requires `scope` for normal card behavior.
- Existing cards with `scope` remain readable through migration or compatibility handling.
- Track ownership remains the supported way to group card intent/context.
- UI and MCP APIs do not expose confusing duplicate concepts for scope vs track.