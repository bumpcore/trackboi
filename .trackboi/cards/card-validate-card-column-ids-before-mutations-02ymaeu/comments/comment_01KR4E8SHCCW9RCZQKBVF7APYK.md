---
id: "comment_01KR4E8SHCCW9RCZQKBVF7APYK"
cardId: "card-validate-card-column-ids-before-mutations-02ymaeu"
createdAt: "2026-05-08T18:40:46.636Z"
updatedAt: "2026-05-08T18:40:46.636Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Added core validation for card column mutations. `createCard`, `updateCard`, and `moveCard` now reject column ids that are not present on the target board, with a clear list of valid ids. Rank calculation for creates/moves is also scoped to the target board so same-column ids on other boards do not affect placement.

Compatibility preserved: legacy branch-scoped cards still materialize their synthetic track when edited.

Verified:
- `bun test tests/core/actions.test.ts tests/core/runtime.test.ts tests/cli/mcp.test.ts`
- `bun test tests/core tests/cli tests/electron tests/ui/*.test.ts`