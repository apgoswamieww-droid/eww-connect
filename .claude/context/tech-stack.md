# Tech Stack — EWW Connect

## Frontend
- **Framework:** Next.js (App Router)
- **UI Library:** React 18+
- **Styling:** Tailwind CSS
- **State Management:** React Context / Zustand (for real-time state)
- **Desktop Shell:** Electron.js (wraps the Next.js production build)

## Backend
- **Runtime:** Node.js (LTS)
- **API:** Next.js API routes (REST, `/api/v1/...`)
- **Real-time:** Standalone Socket.io server (separate Node process, since Next.js serverless functions don't support persistent WebSocket connections well)
- **Validation:** Zod

## Database
- **DB:** PostgreSQL
- **ORM:** Prisma
- **Migrations:** Prisma Migrate

## Auth
- **Library:** NextAuth.js
- **Strategy:** JWT-based sessions
- **Password Hashing:** bcrypt

## File Storage
- **MVP:** Local filesystem (server-side, organized by org/channel)
- **Later:** S3-compatible object storage (AWS S3 / MinIO)

## Dev & Deployment
- **OS:** Ubuntu 24.04 (dev environment)
- **Package Manager:** npm / pnpm
- **Monorepo:** Consider Turborepo if `apps/web` + `apps/desktop` + `server` grow complex
- **CI:** GitHub Actions (lint, test, build)

## Why This Stack (Rationale)
- **Next.js + React:** Familiar, huge ecosystem, good DX, SSR where needed
- **Electron:** Reuses the same React codebase for desktop — no separate desktop UI to maintain
- **Socket.io over raw WebSocket:** Built-in reconnection, rooms (perfect for channels), fallback transport
- **PostgreSQL + Prisma:** Strong relational structure fits org → team → channel → message hierarchy; Prisma gives type-safety end-to-end
- **NextAuth.js:** Reduces custom auth code, well-integrated with Next.js
