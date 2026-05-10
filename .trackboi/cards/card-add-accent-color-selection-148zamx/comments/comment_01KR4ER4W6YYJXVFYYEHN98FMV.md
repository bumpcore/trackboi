---
id: "comment_01KR4ER4W6YYJXVFYYEHN98FMV"
cardId: "card-add-accent-color-selection-148zamx"
createdAt: "2026-05-08T18:49:09.765Z"
updatedAt: "2026-05-08T18:49:09.765Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Added renderer-local accent color preferences with an Appearance settings palette. Accent selection persists with the existing app preferences, applies root `--primary`, `--primary-foreground`, and `--ring` tokens for selected states/focus rings/primary actions, and falls back to amber for malformed stored values.

Verified:
- `bun test tests/ui/appPreferences.test.ts tests/ui tests/electron/adapters.test.ts`
- `bun run build`