import prisma from "../lib/prisma";
import { z } from "zod";

export const createAttachmentSchema = z.object({
  messageId: z.string().min(1),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
});

export async function createAttachmentRecord(input: z.infer<typeof createAttachmentSchema>) {
  const parsed = createAttachmentSchema.parse(input);

  return prisma.attachment.create({
    data: {
      messageId: parsed.messageId,
      fileName: parsed.fileName,
      fileUrl: parsed.fileUrl,
      fileType: parsed.fileType,
      fileSize: parsed.fileSize,
    },
  });
}

export async function listAttachments(messageId: string) {
  return prisma.attachment.findMany({
    where: { messageId },
    orderBy: { createdAt: "asc" },
  });
}
