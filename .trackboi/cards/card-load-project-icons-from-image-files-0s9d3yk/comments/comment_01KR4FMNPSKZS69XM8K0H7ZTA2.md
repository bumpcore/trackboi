---
id: "comment_01KR4FMNPSKZS69XM8K0H7ZTA2"
cardId: "card-load-project-icons-from-image-files-0s9d3yk"
createdAt: "2026-05-08T19:04:44.505Z"
updatedAt: "2026-05-08T19:04:44.505Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Added local project icon support. Project metadata now persists `iconPath`, the Electron bridge exposes an image-file chooser, project settings can choose/save/clear the icon path, and project/worktree markers render PNG and other local image files with the initial/color fallback when the file is missing or invalid.

Verified:
- `bun test tests/core/storage.test.ts tests/electron/adapters.test.ts tests/ui/projectIcon.test.ts tests/ui tests/cli/mcp.test.ts`
- `bun run build`