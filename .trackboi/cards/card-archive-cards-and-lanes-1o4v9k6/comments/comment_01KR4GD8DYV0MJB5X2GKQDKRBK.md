---
id: "comment_01KR4GD8DYV0MJB5X2GKQDKRBK"
cardId: "card-archive-cards-and-lanes-1o4v9k6"
createdAt: "2026-05-08T19:18:10.110Z"
updatedAt: "2026-05-08T19:18:10.110Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Implemented non-destructive archive support for cards and lanes.

Changed:
- Added persisted `archivedAt` metadata for cards and columns.
- Board/table presentation now hides archived cards and archived columns by default.
- Card archive action is available from the board card action/context menu, while destructive delete remains explicit.
- Column archive action is available from the column header and prevents hiding the last active column.
- Board settings now lists archived cards and columns with restore actions.
- Storage/runtime reads remain compatible with existing cards/boards that do not have archive metadata.

Verified:
- `bun test tests/ui/boardModelExtra.test.ts tests/core/actions.test.ts`
- `bun test tests/core tests/cli tests/electron tests/ui/*.test.ts`
- `bun run build`

Residual:
- `bunx tsc --noEmit` still fails on the existing Vue SFC module declaration errors for `Select.vue` and `App.vue`, unchanged from earlier verification.