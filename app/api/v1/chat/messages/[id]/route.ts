import { NextResponse } from "next/server";
import { editMessage, deleteMessage } from "../../../../../lib/data/chat";
import { errorResponse, requireAuth, requireMessageAccess } from "../../../../../lib/apiAuth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    await requireMessageAccess(session, id);

    const body = await request.json();
    if (!body.content?.trim()) {
      return NextResponse.json({ success: false, error: "Content is required" }, { status: 400 });
    }

    const message = await editMessage(id, body.content.trim());
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    return errorResponse(error, "Failed to edit message");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    await requireMessageAccess(session, id);

    const message = await deleteMessage(id);
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    return errorResponse(error, "Failed to delete message");
  }
}
