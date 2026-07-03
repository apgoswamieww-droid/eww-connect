import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { errorResponse, requireAuth, requireOrganizationAccess } from "../../../../lib/apiAuth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    await requireOrganizationAccess(session, session.organizationId);

    if (session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Only admins can update user roles" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { role } = body;

    if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return errorResponse(error, "Failed to update user");
  }
}
