import { NextResponse } from "next/server";
import { listMessages, sendMessage } from "../../../../lib/data/chat";
import { errorResponse, requireAuth, requireConversationMember } from "../../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ success: false, error: "conversationId is required" }, { status: 400 });
    }

    await requireConversationMember(session, conversationId);

    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const result = await listMessages(conversationId, cursor, limit);
    return NextResponse.json({ success: true, data: result.messages, hasMore: result.hasMore });
  } catch (error) {
    return errorResponse(error, "Failed to list messages");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    await requireConversationMember(session, body.conversationId);

    const message = await sendMessage({ ...body, senderId: session.userId });
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    return errorResponse(error, "Failed to send message");
  }
}
