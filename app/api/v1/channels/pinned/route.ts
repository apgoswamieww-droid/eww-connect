import { NextResponse } from "next/server";
import { pinMessage, unpinMessage, listPinnedMessages } from "../../../../lib/data/channels";
import { errorResponse, requireAuth, requireChannelAccess } from "../../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json({ success: false, error: "channelId is required" }, { status: 400 });
    }

    await requireChannelAccess(session, channelId);

    const pinned = await listPinnedMessages(channelId);
    return NextResponse.json({ success: true, data: pinned });
  } catch (error) {
    return errorResponse(error, "Failed to list pinned messages");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { channelId, messageId } = body;

    if (!channelId || !messageId) {
      return NextResponse.json({ success: false, error: "channelId and messageId are required" }, { status: 400 });
    }

    await requireChannelAccess(session, channelId);

    const pinned = await pinMessage(channelId, messageId);
    return NextResponse.json({ success: true, data: pinned });
  } catch (error) {
    return errorResponse(error, "Failed to pin message");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const messageId = searchParams.get("messageId");

    if (!channelId || !messageId) {
      return NextResponse.json({ success: false, error: "channelId and messageId are required" }, { status: 400 });
    }

    await requireChannelAccess(session, channelId);

    await unpinMessage(channelId, messageId);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return errorResponse(error, "Failed to unpin message");
  }
}
