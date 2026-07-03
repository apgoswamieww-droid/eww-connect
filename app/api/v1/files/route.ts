import { NextResponse } from "next/server";
import { createAttachmentRecord, listAttachments, listOrganizationAttachments } from "../../../lib/data/files";
import { errorResponse, requireAuth, requireMessageAccess } from "../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    const recent = searchParams.get("recent");

    if (messageId) {
      await requireMessageAccess(session, messageId);
      const attachments = await listAttachments(messageId);
      return NextResponse.json({ success: true, data: attachments });
    }

    if (recent === "true") {
      const cursor = searchParams.get("cursor") ?? undefined;
      const limit = Math.min(Number(searchParams.get("limit")) || 30, 100);
      const result = await listOrganizationAttachments(session.organizationId, cursor, limit);
      return NextResponse.json({ success: true, data: result.items, hasMore: result.hasMore });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    return errorResponse(error, "Failed to list attachments");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    await requireMessageAccess(session, body.messageId);

    const attachment = await createAttachmentRecord(body);
    return NextResponse.json({ success: true, data: attachment });
  } catch (error) {
    return errorResponse(error, "Failed to create attachment");
  }
}
