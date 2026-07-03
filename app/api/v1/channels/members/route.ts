import { NextResponse } from "next/server";
import { errorResponse, requireAuth, requireChannelAccess } from "../../../../lib/apiAuth";
import prisma from "../../../../lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json({ success: false, error: "channelId is required" }, { status: 400 });
    }

    await requireChannelAccess(session, channelId);

    const members = await prisma.channelMember.findMany({
      where: { channelId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    return errorResponse(error, "Failed to list channel members");
  }
}
