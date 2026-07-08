import prisma from "../prisma";

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const reaction = await prisma.messageReaction.upsert({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
    update: {},
    create: { messageId, userId, emoji },
    include: { user: { select: { id: true, name: true } } },
  });
  tryEmitReactionEvent("reaction:added", reaction);
  return reaction;
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  await prisma.messageReaction.deleteMany({
    where: { messageId, userId, emoji },
  });
  tryEmitReactionEvent("reaction:removed", { messageId, userId, emoji });
}

export async function getReactions(messageId: string) {
  return prisma.messageReaction.findMany({
    where: { messageId },
    include: { user: { select: { id: true, name: true } } },
  });
}

type ReactionPayload = {
  messageId: string;
  userId?: string;
  emoji?: string;
  user?: { id: string; name: string };
  [key: string]: unknown;
};

async function tryEmitReactionEvent(event: string, payload: ReactionPayload) {
  try {
    const jwt = await import("jsonwebtoken");
    const token = jwt.default.sign(
      { sub: payload.userId ?? "system", email: "system@eww-connect.local", type: "access" },
      process.env.JWT_SECRET ?? "dev-secret",
      { expiresIn: "5m" },
    );
    const { io } = await import("socket.io-client");
    const socket = io(process.env.SOCKET_URL ?? "http://localhost:3333", {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    socket.emit(event, payload);
    socket.disconnect();
  } catch {}
}
