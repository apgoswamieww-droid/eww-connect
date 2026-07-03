import prisma from "../lib/prisma";
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

export async function listMessages(conversationId: string) {
  return prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
