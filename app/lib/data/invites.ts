import crypto from "crypto";
import prisma from "../prisma";

const INVITE_EXPIRY_DAYS = 7;

export async function createInvite(organizationId: string, createdById: string, email: string) {
  // Check if there's already a pending invite for this email in this org
  const existing = await prisma.invite.findFirst({
    where: {
      organizationId,
      email: email.toLowerCase(),
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });

  if (existing) {
    throw new Error("A pending invite already exists for this email");
  }

  // Check if user is already in the organization
  const existingUser = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), organizationId },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("This user is already a member of your organization");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.invite.create({
    data: {
      organizationId,
      email: email.toLowerCase(),
      token,
      createdById,
      expiresAt,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  return invite;
}

export async function listInvites(organizationId: string) {
  const invites = await prisma.invite.findMany({
    where: { organizationId },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Mark expired invites
  const now = new Date();
  return invites.map((invite) => ({
    ...invite,
    isExpired: invite.status === "PENDING" && invite.expiresAt <= now,
  }));
}

export async function validateInviteToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!invite) {
    throw new Error("Invalid invitation token");
  }

  if (invite.status !== "PENDING") {
    throw new Error("This invitation has already been used");
  }

  if (invite.expiresAt <= new Date()) {
    throw new Error("This invitation has expired");
  }

  return invite;
}

export async function acceptInvite(token: string) {
  const invite = await validateInviteToken(token);

  await prisma.invite.update({
    where: { id: invite.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });

  return invite.organizationId;
}

export async function cancelInvite(inviteId: string, organizationId: string) {
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, organizationId },
  });

  if (!invite) {
    throw new Error("Invite not found");
  }

  await prisma.invite.update({
    where: { id: inviteId },
    data: { status: "EXPIRED" },
  });
}
