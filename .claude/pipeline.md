# Feature Pipeline — SDLC Orchestration

Every new feature in EWW Connect flows through the following agent stages, in order. Each agent reads `CLAUDE.md` + relevant `context/` files before acting.

## Pipeline Stages

### 1. Planning (`agents/planning-agent.md`)
- Break feature request into tasks
- Define acceptance criteria
- Identify affected modules (chat, channels, files, meetings, auth)
- Output: task breakdown + Prisma schema changes (if any)

### 2. Backend (`agents/backend-agent.md`)
- Implement Prisma schema updates
- Build API routes / Socket.io event handlers
- Write unit tests for business logic

### 3. Frontend (`agents/frontend-agent.md`)
- Build React components (Next.js)
- Wire up to backend APIs / Socket.io events
- Ensure Electron compatibility (no browser-only APIs without checks)

### 4. Security Review (`agents/security-agent.md`)
- Validate input sanitization
- Check auth/authorization on new endpoints
- Review file upload / real-time event handling for abuse vectors

### 5. QA (`agents/qa-agent.md`)
- Write/execute test cases (unit + integration)
- Manual test checklist for real-time features
- Cross-check Electron desktop build

### 6. PR Review (`agents/pr-review-agent.md`)
- Code quality & convention check against `CLAUDE.md`
- Confirm all above stages completed
- Approve/request changes

## Rules
- No stage can be skipped for features touching Auth, Messaging, or File Storage
- Minor UI-only changes may skip Backend/Security stages (Planning agent decides)
- Every stage output should be logged in the PR description
