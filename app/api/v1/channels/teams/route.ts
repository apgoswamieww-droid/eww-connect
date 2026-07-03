import { NextResponse } from "next/server";
import { createTeam, listTeams } from "../../../../channels/channels";
import { errorResponse, requireAuth, requireOrganizationAccess } from "../../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? session.organizationId;

    await requireOrganizationAccess(session, organizationId);

    const teams = await listTeams(organizationId);
    return NextResponse.json({ success: true, data: teams });
  } catch (error) {
    return errorResponse(error, "Failed to list teams");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const organizationId = body.organizationId ?? session.organizationId;
    await requireOrganizationAccess(session, organizationId);

    const team = await createTeam({
      organizationId,
      name: body.name,
      description: body.description,
    });
    return NextResponse.json({ success: true, data: team });
  } catch (error) {
    return errorResponse(error, "Failed to create team");
  }
}
