---
id: "comment_01KR4G2S9Q1425CKPKBHKM882A"
cardId: "card-show-card-details-in-a-jumbo-popover-1j98reb"
createdAt: "2026-05-08T19:12:26.935Z"
updatedAt: "2026-05-08T19:12:26.935Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Added a read-only jumbo card detail popover on the board. Clicking/focusing a card opens a large fixed popover with the title, id, description, and comments; outside click/Escape/close dismiss it; double-click or the footer action still opens the full editor for deeper edits.

Verified:
- `bun test tests/ui tests/electron/adapters.test.ts`
- `bun run build`