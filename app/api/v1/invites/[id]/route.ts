import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "../../../../lib/apiAuth";
import { cancelInvite } from "../../../../lib/data/invites";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only admins can cancel invites" },
        { status: 403 },
      );
    }

    const { id } = await params;
    await cancelInvite(id, session.organizationId);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return errorResponse(error, "Failed to cancel invite");
  }
}
