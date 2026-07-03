import prisma from "../prisma";
import { z } from "zod";

export const createReminderSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().optional(),
  dueAt: z.string().datetime().optional(),
});

export async function createReminder(input: z.infer<typeof createReminderSchema>) {
  const parsed = createReminderSchema.parse(input);

  return prisma.reminder.create({
    data: {
      userId: parsed.userId,
      title: parsed.title,
      message: parsed.message,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
    },
  });
}

export async function listReminders(userId: string) {
  return prisma.reminder.findMany({
    where: { userId },
    orderBy: { dueAt: "asc" },
  });
}

export async function markReminderCompleted(id: string) {
  return prisma.reminder.update({
    where: { id },
    data: { isCompleted: true },
  });
}

export async function updateReminder(id: string, data: { title?: string; message?: string; dueAt?: Date | null }) {
  return prisma.reminder.update({
    where: { id },
    data,
  });
}

export async function deleteReminder(id: string) {
  return prisma.reminder.delete({
    where: { id },
  });
}
