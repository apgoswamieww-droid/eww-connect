import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../app/lib/prisma";
import { signupUser } from "../app/auth/auth";
import { createAttachmentRecord, listAttachments } from "../app/lib/data/files";

test("attachments can be recorded and listed for a message", async () => {
  const user = await signupUser({
    name: "File User",
    email: `files-${Date.now()}@example.com`,
    password: "password123",
  });

  const message = await prisma.message.create({
    data: {
      senderId: user.user.id,
      content: "Sharing a file",
    },
  });

  const created = await createAttachmentRecord({
    messageId: message.id,
    fileName: "design.png",
    fileUrl: "/uploads/design.png",
    fileType: "image/png",
    fileSize: 128,
  });

  const attachments = await listAttachments(message.id);

  assert.equal(created.fileName, "design.png");
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].fileUrl, "/uploads/design.png");
});
