---
id: "card-gracefully-handle-empty-card-folders-without-ind-0u3c1pf"
boardId: "default"
title: "Gracefully handle empty card folders without index.md"
parentId: null
scope: {"kind":"project","ref":"global"}
trackId: null
column: "backlog"
rank: "j"
labels: []
assignee: null
fieldValues: {}
createdAt: "2026-05-07T11:32:30.436Z"
updatedAt: "2026-05-07T11:32:30.436Z"
createdBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
updatedBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
---
The app currently errors when a folder exists under the cards directory but has no `index.md`. Handle this case gracefully.

Acceptance:
- Empty card folders do not crash project/board loading.
- Invalid card folders are skipped or reported non-fatally.
- The UI gives a useful recovery path if user action is needed.