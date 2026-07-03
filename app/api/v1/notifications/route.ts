import { NextResponse } from "next/server";
import { createNotification, listNotifications, markNotificationRead } from "../../../notifications/notifications";
import { errorResponse, requireAuth, requireNotificationOwner } from "../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? session.userId;

    if (userId !== session.userId) {
      return NextResponse.json({ success: false, error: "Cannot list another user's notifications" }, { status: 403 });
    }

    const notifications = await listNotifications(session.userId);
    return NextResponse.json({ success: true, data: notifications });
  } catch (error) {
    return errorResponse(error, "Failed to list notifications");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const notification = await createNotification({ ...body, userId: session.userId });
    return NextResponse.json({ success: true, data: notification });
  } catch (error) {
    return errorResponse(error, "Failed to create notification");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    await requireNotificationOwner(session, body.id);

    const notification = await markNotificationRead(body.id);
    return NextResponse.json({ success: true, data: notification });
  } catch (error) {
    return errorResponse(error, "Failed to update notification");
  }
}
