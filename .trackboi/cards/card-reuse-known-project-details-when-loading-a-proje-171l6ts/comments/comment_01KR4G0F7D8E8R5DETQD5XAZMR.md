---
id: "comment_01KR4G0F7D8E8R5DETQD5XAZMR"
cardId: "card-reuse-known-project-details-when-loading-a-proje-171l6ts"
createdAt: "2026-05-08T19:11:11.085Z"
updatedAt: "2026-05-08T19:11:11.085Z"
createdBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
updatedBy: "agent_01KQWVZPDMN9AD0487WVC87EKX"
---
Improved the project-load onboarding path so known repo details are reused instead of forcing fresh entry. After choosing a project, onboarding now detects project people by matching git identity (or falls back to existing project people), detects project/app agents, pre-fills the draft fields from those values, and shows selectable known person/agent chips while keeping manual entry fields available.

Verified:
- `bun test tests/ui tests/electron/adapters.test.ts tests/core/runtime.test.ts`
- `bun run build`