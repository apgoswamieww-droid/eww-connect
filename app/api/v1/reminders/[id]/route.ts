import { NextResponse } from "next/server";
import { updateReminder, deleteReminder } from "../../../../lib/data/reminders";
import { errorResponse, requireAuth, requireReminderOwner } from "../../../../lib/apiAuth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    await requireReminderOwner(session, id);

    const body = await request.json();
    const data: { title?: string; message?: string; dueAt?: Date | null; isCompleted?: boolean } = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.message !== undefined) data.message = body.message;
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.isCompleted !== undefined) data.isCompleted = body.isCompleted;

    const reminder = await updateReminder(id, data);
    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    return errorResponse(error, "Failed to update reminder");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    await requireReminderOwner(session, id);

    await deleteReminder(id);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return errorResponse(error, "Failed to delete reminder");
  }
}
