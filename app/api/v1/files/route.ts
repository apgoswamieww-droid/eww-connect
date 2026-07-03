import { NextResponse } from "next/server";
import { createAttachmentRecord, listAttachments } from "../../../files/files";
import { errorResponse, requireAuth, requireMessageAccess } from "../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ success: false, error: "messageId is required" }, { status: 400 });
    }

    await requireMessageAccess(session, messageId);

    const attachments = await listAttachments(messageId);
    return NextResponse.json({ success: true, data: attachments });
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
