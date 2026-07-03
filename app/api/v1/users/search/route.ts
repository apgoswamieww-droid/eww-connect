import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "../../../../lib/apiAuth";
import prisma from "../../../../lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.length < 2) {
      return NextResponse.json({ success: false, error: "Query must be at least 2 characters" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 20,
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return errorResponse(error, "Failed to search users");
  }
}
