import { NextResponse } from "next/server";
import { createConversation, listConversations } from "../../../../lib/data/chat";
import { errorResponse, requireAuth, requireUsersInOrganization } from "../../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? session.userId;

    if (userId !== session.userId) {
      return NextResponse.json({ success: false, error: "Cannot list another user's conversations" }, { status: 403 });
    }

    const conversations = await listConversations(session.userId);
    return NextResponse.json({ success: true, data: conversations });
  } catch (error) {
    return errorResponse(error, "Failed to list conversations");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const participants = Array.isArray(body.participants) ? body.participants : [];
    const uniqueParticipants = Array.from(new Set([session.userId, ...participants]));
    await requireUsersInOrganization(session, uniqueParticipants);

    const conversation = await createConversation(uniqueParticipants, body.name, session.organizationId);
    return NextResponse.json({ success: true, data: conversation });
  } catch (error) {
    return errorResponse(error, "Failed to create conversation");
  }
}
