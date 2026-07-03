import { NextResponse } from "next/server";
import { createMeeting, listMeetings } from "../../../meetings/meetings";
import {
  errorResponse,
  requireAuth,
  requireChannelAccess,
  requireOrganizationAccess,
  requireUsersInOrganization,
} from "../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? session.organizationId;

    await requireOrganizationAccess(session, organizationId);

    const meetings = await listMeetings(organizationId);
    return NextResponse.json({ success: true, data: meetings });
  } catch (error) {
    return errorResponse(error, "Failed to list meetings");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const organizationId = body.organizationId ?? session.organizationId;
    await requireOrganizationAccess(session, organizationId);

    if (body.channelId) {
      await requireChannelAccess(session, body.channelId);
    }

    const participantIds = Array.isArray(body.participantIds)
      ? Array.from(new Set([session.userId, ...body.participantIds]))
      : [session.userId];
    await requireUsersInOrganization(session, participantIds);

    const meeting = await createMeeting({
      ...body,
      organizationId,
      createdById: session.userId,
      participantIds,
    });
    return NextResponse.json({ success: true, data: meeting });
  } catch (error) {
    return errorResponse(error, "Failed to create meeting");
  }
}
