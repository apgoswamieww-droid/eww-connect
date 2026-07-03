import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { errorResponse, requireAuth } from "../../../../lib/apiAuth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const parsed = updateSchema.parse(body);

    if (!parsed.name) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { name: parsed.name },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return errorResponse(error, "Failed to update profile");
  }
}
