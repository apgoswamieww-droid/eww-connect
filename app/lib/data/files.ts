import prisma from "../prisma";

export async function createAttachmentRecord(data: {
  messageId?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}) {
  if (!data.messageId) {
    return { id: `upload-${Date.now()}`, ...data };
  }
  return prisma.attachment.create({
    data: {
      messageId: data.messageId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      fileSize: data.fileSize,
    },
  });
}

export async function listAttachments(messageId: string) {
  return prisma.attachment.findMany({ where: { messageId } });
}

export async function listOrganizationAttachments(organizationId: string, cursor?: string, limit = 30) {
  const items = await prisma.attachment.findMany({
    where: {
      message: {
        conversation: { organizationId },
      },
    },
    include: {
      message: {
        include: { sender: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  return { items, hasMore };
}
