---
id: "comment_01KR4FYSB1JZY9SN51C58QR72E"
cardId: "card-remove-type-prefixes-from-generated-ids-1yz32nh"
createdAt: "2026-05-08T19:10:15.905Z"
updatedAt: "2026-05-08T19:10:15.905Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Updated generated id rules so new ids no longer carry redundant entity prefixes. `newId` now returns a plain ULID, slug ids now use `title-suffix` without `card-`/`track-`, board/column/field fallback ids avoid type-prefixed fallbacks, and the README now documents the convention plus typed references for mixed-entity values. Existing prefixed ids remain readable because lookups are still path/id based.

Verified:
- `bun test tests/core/idRankFrontmatter.test.ts tests/core/storage.test.ts tests/core/tracksStorage.test.ts tests/core/actions.test.ts tests/cli/mcp.test.ts tests/ui tests/electron`
- `bun run build`