import test from "node:test";
import assert from "node:assert/strict";
import { signupUser } from "../app/auth/auth";
import { createConversation, listMessages, sendMessage } from "../app/lib/data/chat";

test("conversation creation and messaging work for participants", async () => {
  const firstEmail = `chat-${Date.now()}-a@example.com`;
  const secondEmail = `chat-${Date.now()}-b@example.com`;

  const firstUser = await signupUser({
    name: "Chat User One",
    email: firstEmail,
    password: "password123",
  });

  const secondUser = await signupUser({
    name: "Chat User Two",
    email: secondEmail,
    password: "password123",
  });

  const conversation = await createConversation([firstUser.user.id, secondUser.user.id], "Pair chat");
  const message = await sendMessage({
    senderId: firstUser.user.id,
    conversationId: conversation.id,
    content: "Hello from the test",
  });

  const result = await listMessages(conversation.id);

  assert.equal(conversation.isGroup, false);
  assert.equal(message.content, "Hello from the test");
  assert.equal(result.messages.length, 1);
});
