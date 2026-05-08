---
id: "comment_01KR4F15JB6J6JMZEQYFXMH09J"
cardId: "card-add-git-commit-actions-for-project-changes-0qi9md8"
createdAt: "2026-05-08T18:54:05.387Z"
updatedAt: "2026-05-08T18:54:05.387Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Added explicit git commit support scoped to trackboi-managed project storage by default. Core can list/commit selected git paths, Electron exposes the bridge and IPC actions, MCP now has `list_git_changes` and `commit_project_changes`, and the command center exposes a dirty-repo commit action that previews included trackboi paths before committing.

Verified:
- `bun test tests/core/git.test.ts tests/cli/mcp.test.ts tests/electron/adapters.test.ts`
- `bun run build`

Note: `bunx tsc --noEmit` still only fails on the existing Vue SFC module resolution errors for `Select.vue` and `App.vue`.