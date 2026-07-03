# EWW Connect

Internal collaboration MVP for IT teams. The app currently includes JWT auth, refresh-token rotation, team channels, direct/group conversations, realtime chat, notifications, reminders, meeting records, and attachment metadata.

## Stack

- Next.js 16 App Router
- React 19
- Prisma 7 with Postgres
- Socket.io realtime server
- Node test runner
- Tailwind CSS

## Environment

Create `.env` with:

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/eww_connect"
JWT_SECRET="replace-me"
REFRESH_TOKEN_SECRET="replace-me-too"
NEXT_PUBLIC_SOCKET_URL="http://localhost:4000"
SOCKET_URL="http://localhost:4000"
CLIENT_ORIGIN="http://localhost:3000"
SOCKET_PORT="4000"
```

Use strong secrets outside local development.

## Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

Run the web app and Socket.io server in separate terminals:

```bash
npm run dev:web
npm run dev:server
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm test
npm run build
```

`npm test` expects a reachable Postgres database from `DATABASE_URL`.

## Auth Model

- Login/signup return a short-lived access token and set a long-lived refresh token in an httpOnly cookie.
- Client REST calls send `Authorization: Bearer <access-token>`.
- Socket.io connections authenticate with the same access token.
- Protected routes derive user identity from the token and reject spoofed `userId`, `senderId`, `createdById`, and cross-organization access.

## Current Gaps

- File support records attachment metadata only; binary upload/storage is not implemented yet.
- Realtime tests are still integration-level candidates; current tests cover service behavior and protected route authorization.
- Refresh-token blacklist/revocation is not persisted yet; logout clears the browser cookie/token.
