---
id: "comment_01KR4FAPSBF99SCMYKFA84KBPD"
cardId: "card-let-users-choose-project-color-0iu5fbu"
createdAt: "2026-05-08T18:59:17.931Z"
updatedAt: "2026-05-08T18:59:17.931Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Added project color configuration in Current project settings. The chosen color is persisted in project metadata, normalized with metadata reads, included in project/worktree view models, and used by project/worktree markers while generated colors remain the fallback when no color is set.

Verified:
- `bun test tests/core/storage.test.ts tests/electron/adapters.test.ts tests/ui tests/cli/mcp.test.ts`
- `bun run build`