import prisma from "../prisma";
import { z } from "zod";

export const createChannelSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  ownerId: z.string().min(1).optional(),
});

export async function createTeam(input: { organizationId: string; name: string; description?: string }) {
  return prisma.team.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
    },
    include: {
      channels: true,
    },
  });
}

export async function pinMessage(channelId: string, messageId: string) {
  return prisma.pinnedMessage.create({
    data: { channelId, messageId },
    include: {
      message: {
        include: {
          sender: { select: { id: true, name: true } },
          reactions: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
}

export async function unpinMessage(channelId: string, messageId: string) {
  await prisma.pinnedMessage.deleteMany({
    where: { channelId, messageId },
  });
}

export async function listPinnedMessages(channelId: string) {
  return prisma.pinnedMessage.findMany({
    where: { channelId },
    include: {
      message: {
        include: {
          sender: { select: { id: true, name: true } },
          reactions: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { pinnedAt: "desc" },
  });
}

export async function createChannel(input: z.infer<typeof createChannelSchema>) {
  const parsed = createChannelSchema.parse(input);
  return prisma.channel.create({
    data: {
      teamId: parsed.teamId,
      name: parsed.name,
      type: parsed.type,
      members: parsed.ownerId
        ? {
            create: {
              userId: parsed.ownerId,
              role: "OWNER",
            },
          }
        : undefined,
    },
  });
}

export async function listTeams(organizationId: string) {
  return prisma.team.findMany({
    where: { organizationId },
    include: {
      channels: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listChannels(teamId: string, userId?: string) {
  return prisma.channel.findMany({
    where: {
      teamId,
      OR: userId
        ? [
            { type: "PUBLIC" },
            {
              members: {
                some: { userId },
              },
            },
          ]
        : undefined,
    },
    orderBy: { createdAt: "asc" },
  });
}
