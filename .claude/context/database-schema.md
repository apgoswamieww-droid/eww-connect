# Database Schema Reference — EWW Connect (MVP)

This is the conceptual model. Actual Prisma schema (`prisma/schema.prisma`) should be derived from this and kept in sync — update this file whenever the schema changes meaningfully.

## Entity Overview

```
Organization
  └── User (role: ADMIN | MANAGER | EMPLOYEE)
        └── Team
              └── Channel (type: PUBLIC | PRIVATE)
                    ├── ChannelMember (User <-> Channel, many-to-many)
                    ├── Message
                    │     └── Attachment
                    └── PinnedMessage (ref to Message)
        └── Conversation (1-on-1 or group chat, not tied to a Channel)
              ├── ConversationMember (User <-> Conversation)
              └── Message
        └── Meeting
              ├── MeetingParticipant (User <-> Meeting, with RSVP status)
        └── Notification (User-scoped)
```

## Key Models (conceptual fields)

### Organization
- id, name, createdAt

### User
- id, organizationId, name, email, passwordHash, role, avatarUrl, createdAt

### Team
- id, organizationId, name, description, createdAt

### Channel
- id, teamId, name, type (PUBLIC/PRIVATE), createdAt

### ChannelMember
- id, channelId, userId, joinedAt, role (MEMBER/OWNER)

### Conversation
- id, organizationId, isGroup (boolean), name (nullable, for group chats), createdAt

### ConversationMember
- id, conversationId, userId, joinedAt

### Message
- id, senderId, channelId (nullable), conversationId (nullable) — exactly one of these set
- content, createdAt, editedAt (nullable), deletedAt (nullable)

### Attachment
- id, messageId, fileUrl, fileName, fileType, fileSize, createdAt

### Meeting
- id, organizationId, channelId (nullable), title, startTime, endTime, createdBy, createdAt

### MeetingParticipant
- id, meetingId, userId, rsvpStatus (PENDING/ACCEPTED/DECLINED)

### Notification
- id, userId, type, payload (JSON), isRead, createdAt

## Indexing Notes
- Message: index on (channelId, createdAt) and (conversationId, createdAt) for fast paginated history
- ChannelMember / ConversationMember: unique composite index on (channelId/conversationId, userId)
- Notification: index on (userId, isRead)

## Open Questions (to resolve during Planning stage of first features)
- Should message edits keep history (audit trail) or just overwrite?
- Soft-delete vs hard-delete for messages/channels?
- File storage path convention (by org/team/channel or flat with DB-tracked paths)?
