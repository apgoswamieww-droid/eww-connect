import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import prisma from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

export type AuthSession = {
  userId: string;
  email: string;
  organizationId: string;
};

type AccessTokenPayload = {
  sub?: string;
  email?: string;
  type?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : fallback },
    { status: 400 },
  );
}

function readBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  return header.slice("Bearer ".length).trim();
}

export async function requireAuth(request: Request): Promise<AuthSession> {
  const token = readBearerToken(request);
  let decoded: AccessTokenPayload;

  try {
    decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  if (!decoded.sub || !decoded.email || decoded.type !== "access") {
    throw new ApiError(401, "Invalid access token");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, email: true, organizationId: true },
  });

  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }

  return {
    userId: user.id,
    email: user.email,
    organizationId: user.organizationId,
  };
}

export async function requireOrganizationAccess(session: AuthSession, organizationId: string) {
  if (session.organizationId !== organizationId) {
    throw new ApiError(403, "You do not have access to this organization");
  }
}

export async function requireUsersInOrganization(session: AuthSession, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds));
  const users = await prisma.user.findMany({
    where: {
      id: { in: uniqueIds },
      organizationId: session.organizationId,
    },
    select: { id: true },
  });

  if (users.length !== uniqueIds.length) {
    throw new ApiError(403, "One or more users are outside your organization");
  }
}

export async function requireTeamAccess(session: AuthSession, teamId: string) {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      organizationId: session.organizationId,
    },
    select: { id: true },
  });

  if (!team) {
    throw new ApiError(403, "You do not have access to this team");
  }
}

export async function requireChannelAccess(session: AuthSession, channelId: string) {
  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      team: {
        organizationId: session.organizationId,
      },
      OR: [
        { type: "PUBLIC" },
        {
          members: {
            some: {
              userId: session.userId,
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  if (!channel) {
    throw new ApiError(403, "You do not have access to this channel");
  }
}

export async function requireConversationMember(session: AuthSession, conversationId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.userId,
      },
    },
    select: { id: true },
  });

  if (!member) {
    throw new ApiError(403, "You are not a member of this conversation");
  }
}

export async function requireMessageAccess(session: AuthSession, messageId: string) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      OR: [
        {
          conversation: {
            members: {
              some: {
                userId: session.userId,
              },
            },
          },
        },
        {
          channel: {
            team: {
              organizationId: session.organizationId,
            },
            OR: [
              { type: "PUBLIC" },
              {
                members: {
                  some: {
                    userId: session.userId,
                  },
                },
              },
            ],
          },
        },
      ],
    },
    select: { id: true },
  });

  if (!message) {
    throw new ApiError(403, "You do not have access to this message");
  }
}

export async function requireNotificationOwner(session: AuthSession, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: session.userId,
    },
    select: { id: true },
  });

  if (!notification) {
    throw new ApiError(403, "You do not have access to this notification");
  }
}

export async function requireReminderOwner(session: AuthSession, reminderId: string) {
  const reminder = await prisma.reminder.findFirst({
    where: {
      id: reminderId,
      userId: session.userId,
    },
    select: { id: true },
  });

  if (!reminder) {
    throw new ApiError(403, "You do not have access to this reminder");
  }
}
