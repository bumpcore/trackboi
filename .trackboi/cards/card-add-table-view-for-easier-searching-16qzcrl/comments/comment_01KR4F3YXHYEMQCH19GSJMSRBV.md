---
id: "comment_01KR4F3YXHYEMQCH19GSJMSRBV"
cardId: "card-add-table-view-for-easier-searching-16qzcrl"
createdAt: "2026-05-08T18:55:36.881Z"
updatedAt: "2026-05-08T18:55:36.881Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Added a board/table view switcher in the board workspace. Table view uses the existing filtered board presentation model, supports search across title, body, id, column, track, assignee, and labels, and rows expose column/track/assignee/updated context while selecting or double-clicking opens the same card workflows.

Verified:
- `bun test tests/ui tests/electron/adapters.test.ts`
- `bun run build`