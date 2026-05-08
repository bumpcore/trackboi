---
id: "comment_01KR4FTN4FWJHGNGS866PQD6DA"
cardId: "card-remove-scope-from-cards-12vkmvg"
createdAt: "2026-05-08T19:08:00.527Z"
updatedAt: "2026-05-08T19:08:00.527Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Removed `scope` from normal card write/API behavior while preserving legacy reads. New card markdown no longer writes a `scope` field, updates no longer normalize a public scope patch, and legacy branch-scoped cards still surface as synthetic tracks and materialize to real tracks on edit. MCP card responses also strip legacy `scope` from cards and variants so `trackId` is the public grouping surface.

Verified:
- `bun test tests/core/actions.test.ts tests/core/runtime.test.ts tests/cli/mcp.test.ts`
- `bun run build`