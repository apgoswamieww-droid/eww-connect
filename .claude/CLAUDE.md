# EWW Connect — Project Conventions & Guidelines

## Project Overview
EWW Connect is a Microsoft Teams–style collaboration platform built for an IT company. It provides real-time chat, channels, file sharing, and meetings/calendar features, delivered as both a web app and a cross-platform desktop app.

## Tech Stack
- **Frontend:** Next.js (React) — shared codebase for Web + Electron
- **Desktop Wrapper:** Electron.js
- **Backend API:** Node.js (Express)
- **Real-time Server:** Node.js + Socket.io (separate process from Next.js API routes)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** NextAuth.js (JWT-based sessions)
- **File Storage:** Local disk (MVP) → S3-compatible storage (later)
- **Styling:** Tailwind CSS

## MVP Scope (Phase 1)
1. Auth & Organization/Team setup
2. Chat (1-on-1 + group) — real-time via Socket.io
3. Channels (team/department channels, members, pinned messages)
4. File sharing (upload/download/preview in chats & channels)
5. Meetings/Calendar (schedule, reminders, notifications)

**Explicitly OUT of MVP scope:** Video/Audio calling (WebRTC) — planned for Phase 2.

## Repository Structure
```
eww-connect/
├── apps/
│   ├── web/          # Next.js app (web + shared UI for Electron)
│   └── desktop/       # Electron wrapper around the Next.js build
├── server/            # Standalone Socket.io real-time server
├── prisma/
│   └── schema.prisma
├── .claude/           # AI-native dev workflow (this folder)
└── docs/
```

## Coding Conventions
- TypeScript everywhere (strict mode)
- ESLint + Prettier enforced pre-commit
- API routes: RESTful naming (`/api/v1/...`)
- Real-time events: namespaced (e.g. `chat:message`, `channel:join`, `meeting:reminder`)
- Prisma models: PascalCase; fields: camelCase
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- Every feature must pass through the agent pipeline defined in `pipeline.md` before merging

## Environment
- OS: Ubuntu 24.04
- Node.js: LTS
- Database: PostgreSQL (local via Docker or native install)

## Security Baseline
- All API endpoints require authentication except `/api/v1/auth/*`
- Passwords hashed with bcrypt/argon2
- Input validation via Zod on every API route
- Rate limiting on auth & message endpoints
- File uploads: type/size validation, virus-scan hook placeholder

## Agent Roles
See `agents/` folder for individual agent instructions:
- `planning-agent.md`
- `backend-agent.md`
- `frontend-agent.md`
- `security-agent.md`
- `qa-agent.md`
- `pr-review-agent.md`

## Context Files
See `context/` folder for domain-specific reference material:
- `project-overview.md`
- `tech-stack.md`
- `features.md`
- `database-schema.md`
