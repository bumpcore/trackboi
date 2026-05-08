---
id: "comment_01KR4E37RF697AVJF25AYS3B3W"
cardId: "card-improve-agent-orientation-and-worktree-detection-0h8vtrh"
createdAt: "2026-05-08T18:37:44.590Z"
updatedAt: "2026-05-08T18:37:44.590Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Implemented orientation context cleanup: `orient_agent({ projectPath })` now reports cwd, requested project, resolved active project/worktree/board, agent context, desktop context, and an explicit mismatch flag. Added coverage for explicit project orientation while the MCP agent context points elsewhere.

Verified:
- `bun test tests/cli/mcp.test.ts`
- `bun test tests/core tests/cli tests/electron tests/ui/*.test.ts`

Note: `bunx tsc --noEmit` still fails on existing Vue SFC module resolution errors for `Select.vue` and `App.vue`, unrelated to this change.