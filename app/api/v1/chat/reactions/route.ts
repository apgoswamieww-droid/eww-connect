import { NextResponse } from "next/server";
import { addReaction, removeReaction } from "../../../../lib/data/reactions";
import { errorResponse, requireAuth, requireMessageAccess } from "../../../../lib/apiAuth";

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { messageId, emoji } = body;

    if (!messageId || !emoji || typeof emoji !== "string") {
      return NextResponse.json({ success: false, error: "messageId and emoji are required" }, { status: 400 });
    }

    await requireMessageAccess(session, messageId);
    const reaction = await addReaction(messageId, session.userId, emoji);
    return NextResponse.json({ success: true, data: reaction });
  } catch (error) {
    return errorResponse(error, "Failed to add reaction");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    const emoji = searchParams.get("emoji");

    if (!messageId || !emoji) {
      return NextResponse.json({ success: false, error: "messageId and emoji are required" }, { status: 400 });
    }

    await requireMessageAccess(session, messageId);
    await removeReaction(messageId, session.userId, emoji);
    return NextResponse.json({ success: true, data: { messageId, emoji } });
  } catch (error) {
    return errorResponse(error, "Failed to remove reaction");
  }
}
