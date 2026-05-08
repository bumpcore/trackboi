---
id: "comment_01KR4EEPPD1KW04D8S37RQX2X9"
cardId: "card-fix-maximize-and-minimize-window-controls-10duq3q"
createdAt: "2026-05-08T18:44:00.333Z"
updatedAt: "2026-05-08T18:44:00.333Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Fixed the maximize button path. The button previously reused the titlebar double-click handler, which intentionally ignored events inside `[data-window-control]`; now button and command-center maximize use a direct `toggleMaximizeWindow` action while titlebar double-click filtering stays available in the composable. Expanded window-shell adapter coverage for minimize, maximize, close, and resize delegation.

Verified:
- `bun test tests/electron/adapters.test.ts tests/ui`
- `bun run build`