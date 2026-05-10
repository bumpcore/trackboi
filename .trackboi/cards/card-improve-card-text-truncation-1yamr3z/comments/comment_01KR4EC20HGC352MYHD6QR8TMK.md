---
id: "comment_01KR4EC20HGC352MYHD6QR8TMK"
cardId: "card-improve-card-text-truncation-1yamr3z"
createdAt: "2026-05-08T18:42:33.617Z"
updatedAt: "2026-05-08T18:42:33.617Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Improved board card text handling with predictable line clamps for titles and description previews. Long titles clamp to 2 lines by default (4 on hover/focus), descriptions clamp to 3 lines by default (5 on hover/focus), and both expose native title text for quick inspection without opening the wrong card.

Verified:
- `bun test tests/ui tests/electron`
- `bun run build`