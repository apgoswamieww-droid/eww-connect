import http from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "../app/lib/prisma.js";

const port = Number(process.env.SOCKET_PORT ?? 3333);
const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

type ClientToServerEvents = {
  join: (payload: { userId: string }) => void;
  leave: (payload: { userId: string }) => void;
  joinConversation: (payload: { conversationId: string }) => void;
  leaveConversation: (payload: { conversationId: string }) => void;
  joinChannel: (payload: { channelId: string }) => void;
  leaveChannel: (payload: { channelId: string }) => void;
  "chat:message": (payload: SocketMessagePayload) => void;
  "notification:created": (payload: NotificationPayload) => void;
  "notification:updated": (payload: NotificationPayload) => void;
  "typing:start": (payload: { conversationId: string; userId: string; name: string }) => void;
  "typing:stop": (payload: { conversationId: string; userId: string }) => void;
  "reaction:added": (payload: ReactionPayload) => void;
  "reaction:removed": (payload: ReactionPayload) => void;
};

type ServerToClientEvents = {
  error: (message: string) => void;
  "chat:message": (payload: ChatMessage) => void;
  "notification:created": (payload: NotificationPayload) => void;
  "notification:updated": (payload: NotificationPayload) => void;
  "typing:start": (payload: { conversationId: string; userId: string; name: string }) => void;
  "typing:stop": (payload: { conversationId: string; userId: string }) => void;
  "user:online": (payload: { userId: string }) => void;
  "user:offline": (payload: { userId: string }) => void;
  "reaction:added": (payload: Record<string, unknown>) => void;
  "reaction:removed": (payload: Record<string, unknown>) => void;
};

type ChatMessage = {
  conversationId?: string | null;
  channelId?: string | null;
  [key: string]: unknown;
};

type SocketMessagePayload = { message: ChatMessage };

type NotificationPayload = {
  userId?: string;
  [key: string]: unknown;
};

type ReactionPayload = {
  messageId?: string;
  message?: { conversationId?: string; channelId?: string };
  [key: string]: unknown;
};

// Verify user is a member of a conversation
async function isConversationMember(
  userId: string,
  conversationId: string
): Promise<boolean> {
  try {
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });
    return !!member;
  } catch (error) {
    console.error("Error checking conversation membership:", error);
    return false;
  }
}

async function canJoinChannel(userId: string, channelId: string): Promise<boolean> {
  try {
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        OR: [
          { type: "PUBLIC" },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      select: { id: true },
    });

    return !!channel;
  } catch (error) {
    console.error("Error checking channel membership:", error);
    return false;
  }
}

function unwrapMessage(payload: SocketMessagePayload): ChatMessage {
  return payload.message;
}

const httpServer = http.createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const onlineUsers = new Set<string>();

// JWT verification middleware
io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication token required"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string; type?: string };
    if (decoded.type !== "access") {
      return next(new Error("Invalid token type"));
    }
    socket.userId = decoded.sub;
    socket.email = decoded.email;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket: AuthenticatedSocket) => {
  const uid = socket.userId;
  console.log(`Socket connected: ${socket.id} (userId: ${uid})`);

  if (uid && !onlineUsers.has(uid)) {
    onlineUsers.add(uid);
    io.emit("user:online", { userId: uid });
  }

  socket.on("join", ({ userId }: { userId: string }) => {
    if (socket.userId !== userId) {
      socket.emit("error", "Unauthorized: cannot join another user's room");
      return;
    }
    const room = `user:${userId}`;
    socket.join(room);
    if (!onlineUsers.has(userId)) {
      onlineUsers.add(userId);
      io.emit("user:online", { userId });
    }
  });

  socket.on("leave", ({ userId }: { userId: string }) => {
    if (socket.userId !== userId) {
      socket.emit("error", "Unauthorized: cannot leave another user's room");
      return;
    }
    const room = `user:${userId}`;
    socket.leave(room);
  });

  socket.on("joinConversation", async ({ conversationId }: { conversationId: string }) => {
    if (!conversationId || !socket.userId) return;
    
    // Verify user is a member of this conversation
    const isMember = await isConversationMember(socket.userId, conversationId);
    if (!isMember) {
      socket.emit("error", `Unauthorized: not a member of conversation ${conversationId}`);
      return;
    }
    
    const room = `conversation:${conversationId}`;
    socket.join(room);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
  });

  socket.on("leaveConversation", ({ conversationId }: { conversationId: string }) => {
    if (!conversationId) return;
    const room = `conversation:${conversationId}`;
    socket.leave(room);
  });

  socket.on("joinChannel", async ({ channelId }: { channelId: string }) => {
    if (!channelId || !socket.userId) return;

    const isMember = await canJoinChannel(socket.userId, channelId);
    if (!isMember) {
      socket.emit("error", `Unauthorized: not a member of channel ${channelId}`);
      return;
    }

    socket.join(`channel:${channelId}`);
  });

  socket.on("leaveChannel", ({ channelId }: { channelId: string }) => {
    if (!channelId) return;
    socket.leave(`channel:${channelId}`);
  });

  // targeted chat message: { message }
  // emit to conversation room for efficiency (conversation:<id>)
  socket.on("chat:message", (payload) => {
    const message = unwrapMessage(payload);
    const convId = message?.conversationId;
    if (convId) {
      io.to(`conversation:${convId}`).emit("chat:message", message);
    }

    const channelId = message?.channelId;
    if (channelId) {
      io.to(`channel:${channelId}`).emit("chat:message", message);
    }
  });

  socket.on("notification:created", (n) => {
    const userId = n?.userId;
    if (userId) io.to(`user:${userId}`).emit("notification:created", n);
  });

  socket.on("notification:updated", (n) => {
    const userId = n?.userId;
    if (userId) io.to(`user:${userId}`).emit("notification:updated", n);
  });

  socket.on("typing:start", (payload) => {
    const { conversationId, userId, name } = payload;
    if (!conversationId || !userId || userId !== socket.userId) return;
    socket.to(`conversation:${conversationId}`).emit("typing:start", { conversationId, userId, name });
  });

  socket.on("typing:stop", (payload) => {
    const { conversationId, userId } = payload;
    if (!conversationId || !userId || userId !== socket.userId) return;
    socket.to(`conversation:${conversationId}`).emit("typing:stop", { conversationId, userId });
  });

  socket.on("reaction:added", (payload: ReactionPayload) => {
    const convId = payload.message?.conversationId;
    if (convId) io.to(`conversation:${convId}`).emit("reaction:added", payload);
    const channelId = payload.message?.channelId;
    if (channelId) io.to(`channel:${channelId}`).emit("reaction:added", payload);
  });

  socket.on("reaction:removed", (payload: ReactionPayload) => {
    const convId = payload.message?.conversationId;
    if (convId) io.to(`conversation:${convId}`).emit("reaction:removed", payload);
    const channelId = payload.message?.channelId;
    if (channelId) io.to(`channel:${channelId}`).emit("reaction:removed", payload);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id} (userId: ${uid})`);
    if (uid) {
      const stillConnected = Array.from(io.sockets.sockets.values()).some(
        (s) => (s as AuthenticatedSocket).userId === uid && s.id !== socket.id,
      );
      if (!stillConnected) {
        onlineUsers.delete(uid);
        io.emit("user:offline", { userId: uid });
      }
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.io server listening on port ${port}`);
});
