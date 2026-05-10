---
id: "comment_01KR4EAB5RD01JP5MRQKTE9EBV"
cardId: "card-gracefully-handle-empty-card-folders-without-ind-0u3c1pf"
createdAt: "2026-05-08T18:41:37.464Z"
updatedAt: "2026-05-08T18:41:37.464Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Hardened card storage reads so directories under `cards/` without `index.md` are skipped instead of crashing project/board loading. Added a focused storage test for an empty card folder.

Verified:
- `bun test tests/core/storage.test.ts tests/core/runtime.test.ts`
- `bun test tests/core tests/cli tests/electron tests/ui/*.test.ts`