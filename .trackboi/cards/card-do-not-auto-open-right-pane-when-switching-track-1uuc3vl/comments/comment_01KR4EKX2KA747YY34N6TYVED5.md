---
id: "comment_01KR4EKX2KA747YY34N6TYVED5"
cardId: "card-do-not-auto-open-right-pane-when-switching-track-1uuc3vl"
createdAt: "2026-05-08T18:46:50.707Z"
updatedAt: "2026-05-08T18:46:50.707Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Track switching now updates the right-panel view target without revealing a collapsed panel. `setRightView` supports `{ reveal: false }`, and `focusTrack` uses it so explicit commands/create/edit flows still open the panel while track selection preserves collapse state.

Verified:
- `bun test tests/ui/workspaceShellState.test.ts tests/ui tests/electron/adapters.test.ts`
- `bun run build`