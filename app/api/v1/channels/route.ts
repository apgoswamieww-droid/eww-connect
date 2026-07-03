import { NextResponse } from "next/server";
import { createChannel, listChannels } from "../../../lib/data/channels";
import { errorResponse, requireAuth, requireTeamAccess } from "../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json({ success: false, error: "teamId is required" }, { status: 400 });
    }

    await requireTeamAccess(session, teamId);

    const channels = await listChannels(teamId, session.userId);
    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    return errorResponse(error, "Failed to list channels");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    await requireTeamAccess(session, body.teamId);

    const channel = await createChannel({ ...body, ownerId: session.userId });
    return NextResponse.json({ success: true, data: channel });
  } catch (error) {
    return errorResponse(error, "Failed to create channel");
  }
}
