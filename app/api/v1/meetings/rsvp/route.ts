import { NextResponse } from "next/server";
import { updateRsvp } from "../../../../lib/data/meetings";
import { errorResponse, requireAuth } from "../../../../lib/apiAuth";
import prisma from "../../../../lib/prisma";

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { meetingId, status } = body;

    if (!meetingId || !["ACCEPTED", "DECLINED"].includes(status)) {
      return NextResponse.json({ success: false, error: "meetingId and status (ACCEPTED|DECLINED) required" }, { status: 400 });
    }

    const participant = await prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: session.userId } },
    });

    if (!participant) {
      return NextResponse.json({ success: false, error: "You are not a participant of this meeting" }, { status: 403 });
    }

    const updated = await updateRsvp(meetingId, session.userId, status);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return errorResponse(error, "Failed to update RSVP");
  }
}
