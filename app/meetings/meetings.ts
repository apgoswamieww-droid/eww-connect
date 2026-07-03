import prisma from "../lib/prisma";
import { z } from "zod";

export const createMeetingSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  createdById: z.string().min(1),
  channelId: z.string().optional(),
  participantIds: z.array(z.string()).default([]),
});

export async function createMeeting(input: z.infer<typeof createMeetingSchema>) {
  const parsed = createMeetingSchema.parse(input);

  const meeting = await prisma.meeting.create({
    data: {
      organizationId: parsed.organizationId,
      title: parsed.title,
      description: parsed.description,
      startTime: new Date(parsed.startTime),
      endTime: new Date(parsed.endTime),
      createdById: parsed.createdById,
      channelId: parsed.channelId,
      participants: {
        create: parsed.participantIds.map((userId) => ({
          userId,
          rsvpStatus: "PENDING",
        })),
      },
    },
    include: {
      participants: true,
    },
  });

  return meeting;
}

export async function listMeetings(organizationId: string) {
  return prisma.meeting.findMany({
    where: { organizationId },
    include: {
      participants: true,
    },
    orderBy: { startTime: "asc" },
  });
}
