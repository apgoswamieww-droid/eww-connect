# Features — EWW Connect (MVP Detail)

## 1. Authentication & Organization
- Signup/Login (email + password, JWT session)
- Roles: Admin, Manager, Employee
- Organization setup (single org per deployment for MVP)
- Team creation (Admin/Manager)
- User invite (via email, admin-generated invite link)

## 2. Chat
- 1-on-1 direct messages
- Group chat (ad-hoc, not tied to a channel)
- Real-time delivery (Socket.io)
- Message history (paginated, persisted in DB)
- Typing indicators
- Read receipts (basic: seen/unseen)
- Emoji reactions (optional stretch)

## 3. Channels
- Channels belong to a Team
- Public channels (all team members auto-joined) vs Private channels (invite-only)
- Channel members list, add/remove (Manager/Admin)
- Pinned messages
- Channel-level file repository (see Files)

## 4. File Sharing
- Upload files in chat or channel (drag-drop + file picker)
- File type/size validation (configurable limits)
- Inline preview for images/PDFs; download for other types
- Files listed per-channel in a "Files" tab

## 5. Meetings/Calendar
- Schedule a meeting (title, participants, date/time, channel-linked optional)
- Calendar view (per user, aggregated from meetings they're part of)
- Reminders (in-app notification before meeting start)
- RSVP (accept/decline)
- **No live video/audio in MVP** — this is scheduling only; actual call joins are Phase 2

## 6. Notifications
- Real-time in-app notifications (new message, mention, meeting reminder)
- Notification bell with unread count
- Mark as read

## Explicitly Deferred to Phase 2
- Video/Audio calling (WebRTC)
- Screen sharing
- Mobile app
- Third-party bot/app integrations
- Multi-organization (multi-tenant) support
