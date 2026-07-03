import test from "node:test";
import assert from "node:assert/strict";
import { signupUser } from "../app/auth/auth";
import { createConversation } from "../app/chat/chat";
import { GET as getMessages } from "../app/api/v1/chat/messages/route";
import {
  GET as getReminders,
  POST as postReminder,
} from "../app/api/v1/reminders/route";

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

test("protected API routes reject missing access tokens", async () => {
  const response = await getReminders(new Request("http://localhost/api/v1/reminders"));
  const json = await response.json();

  assert.equal(response.status, 401);
  assert.equal(json.success, false);
});

test("personal routes use the authenticated user instead of trusting body userId", async () => {
  const owner = await signupUser({
    name: "Reminder Owner",
    email: `route-owner-${Date.now()}@example.com`,
    password: "password123",
  });
  const other = await signupUser({
    name: "Reminder Other",
    email: `route-other-${Date.now()}@example.com`,
    password: "password123",
  });

  const createResponse = await postReminder(
    new Request("http://localhost/api/v1/reminders", {
      method: "POST",
      headers: authHeaders(owner.token),
      body: JSON.stringify({
        userId: other.user.id,
        title: "Private reminder",
      }),
    }),
  );
  const createJson = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(createJson.data.userId, owner.user.id);

  const forbiddenResponse = await getReminders(
    new Request(`http://localhost/api/v1/reminders?userId=${owner.user.id}`, {
      headers: authHeaders(other.token),
    }),
  );

  assert.equal(forbiddenResponse.status, 403);
});

test("chat message routes require conversation membership", async () => {
  const first = await signupUser({
    name: "Route Chat One",
    email: `route-chat-${Date.now()}-one@example.com`,
    password: "password123",
  });
  const second = await signupUser({
    name: "Route Chat Two",
    email: `route-chat-${Date.now()}-two@example.com`,
    password: "password123",
  });
  const outsider = await signupUser({
    name: "Route Chat Outsider",
    email: `route-chat-${Date.now()}-outsider@example.com`,
    password: "password123",
  });

  const conversation = await createConversation([first.user.id, second.user.id], "Private pair");
  const response = await getMessages(
    new Request(`http://localhost/api/v1/chat/messages?conversationId=${conversation.id}`, {
      headers: authHeaders(outsider.token),
    }),
  );

  assert.equal(response.status, 403);
});
