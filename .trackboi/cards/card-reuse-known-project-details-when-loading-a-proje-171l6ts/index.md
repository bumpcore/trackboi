---
id: "card-reuse-known-project-details-when-loading-a-proje-171l6ts"
boardId: "default"
title: "Reuse known project details when loading a project folder"
parentId: null
scope: {"kind":"project","ref":"global"}
trackId: null
column: "done"
rank: "j"
labels: []
assignee: null
fieldValues: {}
createdAt: "2026-05-07T11:32:02.287Z"
updatedAt: "2026-05-08T19:11:14.065Z"
createdBy: "agent_01KQY2VDKCWA3AEM5TF72W00FB"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
When loading a project folder, allow selection from pre-defined or previously mapped values instead of forcing the user to re-enter details.

Example: if the user is already mapped on the repo, they should not need to enter their details again.

Acceptance:
- Existing repo/project mappings are detected.
- Known user/project values can be selected.
- Manual entry remains available for new values.