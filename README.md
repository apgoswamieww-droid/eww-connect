# EWW Connect

Internal collaboration platform for IT teams. Chat, channels, file sharing, meetings, and more.

## Stack

- **Next.js 16** App Router with React 19
- **Prisma 6** with PostgreSQL
- **Socket.io** realtime server (port 3333)
- **Node test runner** (built-in)
- **Tailwind CSS** dark theme
- **Docker Compose** for one-command deploy

## Quick Start

### With Docker (recommended)

```bash
docker compose up
```

Opens at `http://localhost:3000`. Postgres, app, and socket server all start automatically.

### Without Docker

```bash
# 1. Create .env (see below)
# 2. Install and setup DB
npm install
npx prisma generate
npx prisma db push

# 3. Run both processes
npm run dev:web     # Next.js on :3000
npm run dev:server  # Socket.io on :3333
```

## Environment

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/eww_connect"
JWT_SECRET="generate-a-strong-secret"
REFRESH_TOKEN_SECRET="generate-another-secret"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3333"
SOCKET_URL="http://localhost:3333"
CLIENT_ORIGIN="http://localhost:3000"
SOCKET_PORT="3333"

# Optional: email notifications
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="user"
SMTP_PASS="pass"
SMTP_FROM="noreply@eww-connect.local"
```

## Features

| Module | Pages | Description |
|--------|-------|-------------|
| Auth | `/login`, `/signup` | JWT access tokens + httpOnly refresh cookies, rate-limited |
| Dashboard | `/dashboard` | Overview with recent notifications and reminders |
| Chat | `/chat` | DM/group conversations, edit/delete, typing indicators, reactions, file attachments, online presence, message search |
| Channels | `/channels` | Teams with public/private channels, member management |
| Files | `/files` | Upload, preview (images/PDF), paginated listing, 50MB limit |
| Meetings | `/meetings` | Schedule with RSVP (accept/decline), upcoming/past views |
| Notifications | `/notifications` | Real-time via socket, mark read, unread badge on sidebar |
| Reminders | `/reminders` | Create/edit/delete/complete, active/completed sections |
| Users | `/users` | Admin role management (ADMIN/MANAGER/EMPLOYEE) |
| Profile | `/profile` | Edit name, view email and role |

## Architecture

```
app/
  (main)/        # Authenticated pages (wrapped in sidebar)
  api/v1/        # REST API routes
  components/    # Shared components (Sidebar, NotificationsPanel)
  lib/
    data/        # Data layer with Prisma + Zod validation
    apiAuth.ts   # Auth middleware for API routes
    tokenManager.ts  # Client-side token management
    email.ts     # SMTP email utility
    rateLimit.ts # In-memory rate limiter
server/
  index.ts       # Socket.io server with JWT auth
prisma/
  schema.prisma  # Database schema
```

## Verification

```bash
npm test        # 10 integration tests (expects Postgres)
npm run build   # Production build
```

## Auth Model

- Login/signup return a short-lived access token and set a refresh token in an httpOnly cookie.
- Client sends `Authorization: Bearer <token>` for REST calls.
- Socket.io authenticates with the same access token.
- All routes derive identity from the token; spoofed `userId`, cross-org access are rejected.

## API Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/signup` | No | Create account |
| POST | `/api/v1/auth/login` | No | Sign in (rate-limited) |
| POST | `/api/v1/auth/logout` | No | Clear refresh cookie |
| POST | `/api/v1/auth/refresh` | Cookie | Rotate tokens |
| PATCH | `/api/v1/auth/profile` | Yes | Update name |
| GET | `/api/v1/users` | Yes | List org users |
| GET | `/api/v1/users/search?q=` | Yes | Search users |
| PATCH | `/api/v1/users/[id]` | Admin | Change role |
| GET/POST | `/api/v1/chat/conversations` | Yes | List/create conversations |
| GET/POST | `/api/v1/chat/messages` | Yes | List/send messages |
| PATCH/DELETE | `/api/v1/chat/messages/[id]` | Yes | Edit/delete message |
| POST/DELETE | `/api/v1/chat/reactions` | Yes | Toggle emoji reactions |
| GET | `/api/v1/chat/search?q=` | Yes | Full-text message search |
| GET/POST | `/api/v1/channels` | Yes | List/create channels |
| GET/POST | `/api/v1/channels/teams` | Yes | List/create teams |
| GET | `/api/v1/channels/members` | Yes | List channel members |
| GET/POST | `/api/v1/files` | Yes | List files |
| POST | `/api/v1/files/upload` | Yes | Upload file (multipart) |
| GET/POST | `/api/v1/meetings` | Yes | List/create meetings |
| PATCH | `/api/v1/meetings/rsvp` | Yes | Accept/decline meeting |
| GET/POST | `/api/v1/notifications` | Yes | List/create notifications |
| PATCH | `/api/v1/notifications` | Yes | Mark notification read |
| GET/POST | `/api/v1/reminders` | Yes | List/create reminders |
| PATCH/DELETE | `/api/v1/reminders/[id]` | Yes | Update/delete reminder |
| GET | `/api/v1/health` | No | Health check |
