import { NextResponse } from "next/server";
import { createReminder, listReminders, markReminderCompleted } from "../../../reminders/reminders";
import { errorResponse, requireAuth, requireReminderOwner } from "../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? session.userId;

    if (userId !== session.userId) {
      return NextResponse.json({ success: false, error: "Cannot list another user's reminders" }, { status: 403 });
    }

    const reminders = await listReminders(session.userId);
    return NextResponse.json({ success: true, data: reminders });
  } catch (error) {
    return errorResponse(error, "Failed to list reminders");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const reminder = await createReminder({ ...body, userId: session.userId });
    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    return errorResponse(error, "Failed to create reminder");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    await requireReminderOwner(session, body.id);

    const reminder = await markReminderCompleted(body.id);
    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    return errorResponse(error, "Failed to update reminder");
  }
}
