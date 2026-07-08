import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "../../../lib/apiAuth";
import { createInvite, listInvites } from "../../../lib/data/invites";
import { sendEmail } from "../../../lib/email";
import { z } from "zod";

const createInviteSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only admins can invite users" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { email } = createInviteSchema.parse(body);

    const invite = await createInvite(session.organizationId, session.userId, email);

    // Send invitation email (best-effort)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const signupLink = `${appUrl}/signup?token=${invite.token}`;

    await sendEmail(
      email,
      "You're invited to join EWW Connect",
      `You've been invited to join EWW Connect!\n\nClick the link below to create your account:\n${signupLink}\n\nThis invitation expires in 7 days.\n\nIf you didn't expect this invitation, you can safely ignore this email.`,
    );

    return NextResponse.json({
      success: true,
      data: {
        id: invite.id,
        email: invite.email,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        createdBy: invite.createdBy,
      },
    });
  } catch (error) {
    return errorResponse(error, "Failed to create invite");
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only admins can view invites" },
        { status: 403 },
      );
    }

    const invites = await listInvites(session.organizationId);

    return NextResponse.json({ success: true, data: invites });
  } catch (error) {
    return errorResponse(error, "Failed to list invites");
  }
}
