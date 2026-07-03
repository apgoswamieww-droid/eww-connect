import test from "node:test";
import assert from "node:assert/strict";
import { signupUser } from "../app/auth/auth";
import { createNotification, listNotifications, markNotificationRead } from "../app/notifications/notifications";

test("notifications can be created, listed, and marked as read", async () => {
  const user = await signupUser({
    name: "Notification User",
    email: `notifications-${Date.now()}@example.com`,
    password: "password123",
  });

  const created = await createNotification({
    userId: user.user.id,
    type: "message",
    payload: { conversationId: "abc" },
  });

  const all = await listNotifications(user.user.id);
  const updated = await markNotificationRead(created.id);

  assert.equal(created.type, "message");
  assert.equal(all.length, 1);
  assert.equal(updated.isRead, true);
});
