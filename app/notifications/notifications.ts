import prisma from "../lib/prisma";
import { z } from "zod";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

export const createNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.any()).default({}),
});

export async function createNotification(input: z.infer<typeof createNotificationSchema>) {
  const parsed = createNotificationSchema.parse(input);

  const notification = await prisma.notification.create({
    data: {
      userId: parsed.userId,
      type: parsed.type,
      payload: parsed.payload,
    },
  });

  tryEmitNotificationEvent("notification:created", notification);
  return notification;
}


export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function markNotificationRead(id: string) {
  const notification = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  tryEmitNotificationEvent("notification:updated", notification);
  return notification;
}

type NotificationSocketPayload = {
  userId: string;
  [key: string]: unknown;
};

async function tryEmitNotificationEvent(event: string, payload: NotificationSocketPayload) {
  try {
    const { io } = await import("socket.io-client");
    const token = jwt.sign(
      {
        sub: payload.userId,
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
    // ignore
  }
}
