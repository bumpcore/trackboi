---
id: "card-add-git-commit-actions-for-project-changes-0qi9md8"
boardId: "default"
title: "Add git commit actions for project changes"
parentId: null
scope: {"kind":"project","ref":"global"}
trackId: null
column: "done"
rank: "j"
labels: []
assignee: null
fieldValues: {}
createdAt: "2026-05-07T11:46:37.100Z"
updatedAt: "2026-05-08T18:54:08.494Z"
createdBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Provide commit support for git-detected projects, with careful treatment of optional autocommit because it can be too aggressive.

Acceptance:
- Git-backed projects expose an explicit commit action in the UI when there are relevant changes.
- MCP exposes a matching commit action for agents so board/project changes can be committed without shelling out manually.
- Optional autocommit, if implemented, is opt-in and clearly scoped to safe trackboi-managed changes.
- The commit flow shows what will be included and avoids committing unrelated user work by default.