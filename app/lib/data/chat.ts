import prisma from "../prisma";
import { z } from "zod";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

type SocketPayload = {
  message?: {
    senderId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

async function tryEmitSocketEvent(event: string, payload: SocketPayload) {
  try {
    const { io } = await import("socket.io-client");
    const token = jwt.sign(
      {
        sub: payload.message?.senderId ?? "system",
        email: "system@eww-connect.local",
        type: "access",
      },
      JWT_SECRET,
      { expiresIn: "5m" },
    );
    const socket = io(process.env.SOCKET_URL ?? "http://localhost:4000", {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    socket.emit(event, payload);
    socket.disconnect();
  } catch {
    // fail silently if socket server isn't available
  }
}

export const sendMessageSchema = z.object({
  senderId: z.string().min(1),
  conversationId: z.string().min(1),
  content: z.string().min(1).max(4000),
});

export async function createConversation(participants: string[], name?: string, organizationId?: string) {
  const organization = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId } })
    : await prisma.organization.findFirst();

  if (!organization) {
    throw new Error("No organization found");
  }

  const conversation = await prisma.conversation.create({
    data: {
      organizationId: organization.id,
      isGroup: participants.length > 2,
      name,
      members: {
        create: participants.map((userId) => ({ userId })),
      },
    },
  });

  return conversation;
}

export async function listConversations(userId: string) {
  return prisma.conversation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function sendMessage(input: z.infer<typeof sendMessageSchema>) {
  const parsed = sendMessageSchema.parse(input);

  const message = await prisma.message.create({
    data: {
      senderId: parsed.senderId,
      conversationId: parsed.conversationId,
      content: parsed.content,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // broadcast via socket (best-effort) to the conversation room
  tryEmitSocketEvent("chat:message", { message });

  return message;
}

export async function listMessages(conversationId: string, cursor?: string, limit = 50) {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: { id: true, name: true, email: true },
      },
      reactions: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();
  return { messages: messages.reverse(), hasMore };
}

export async function searchMessages(userId: string, query: string, limit = 20) {
  return prisma.message.findMany({
    where: {
      conversation: {
        members: { some: { userId } },
      },
      content: { contains: query, mode: "insensitive" },
      deletedAt: null,
    },
    include: {
      sender: { select: { id: true, name: true } },
      conversation: { select: { id: true, name: true, isGroup: true, members: { include: { user: { select: { id: true, name: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function editMessage(messageId: string, content: string) {
  const message = await prisma.message.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: {
      sender: {
        select: { id: true, name: true, email: true },
      },
    },
  });
  tryEmitSocketEvent("chat:message", { message });
  return message;
}

export async function deleteMessage(messageId: string) {
  const message = await prisma.message.update({
    where: { id: messageId },
    data: { content: "[deleted]", deletedAt: new Date() },
  });
  tryEmitSocketEvent("chat:message", { message });
  return message;
}
