import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { errorResponse, requireAuth, requireOrganizationAccess } from "../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    await requireOrganizationAccess(session, session.organizationId);

    const users = await prisma.user.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return errorResponse(error, "Failed to list users");
  }
}
