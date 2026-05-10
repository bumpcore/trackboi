---
id: "comment_01KR4E49B9AJXDJP9GENDH9N42"
cardId: "card-customize-app-title-instead-of-vue-app-1eqfrmd"
createdAt: "2026-05-08T18:38:18.985Z"
updatedAt: "2026-05-08T18:38:18.985Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Updated `src/ui/index.html` so the browser/Electron page title is `trackboi` instead of `Vue App`.

Verified:
- `rg -n "Vue App" src package.json build vite.config.ts` returns no matches.
- `bun test tests/electron tests/ui/*.test.ts tests/ui`