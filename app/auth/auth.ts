import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { z } from "zod";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET ?? "dev-refresh-secret";

// Access token expires in 1 hour, refresh token in 30 days
const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "30d";

import { validateInviteToken, acceptInvite } from "../lib/data/invites";

export const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  inviteToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign({ sub: userId, email, type: "access" }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ sub: userId, email, type: "refresh" }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
  return { accessToken, refreshToken };
}

export async function signupUser(input: z.infer<typeof signupSchema>) {
  const parsed = signupSchema.parse(input);
  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });

  if (existing) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  let organizationId: string;

  if (parsed.inviteToken) {
    // User is accepting an invitation — validate token and get org
    const invite = await validateInviteToken(parsed.inviteToken);
    organizationId = invite.organization.id;
  } else {
    // New standalone signup — create a new org
    const org = await prisma.organization.create({
      data: { name: `${parsed.name}'s Organization` },
    });
    organizationId = org.id;
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      organizationId,
      role: parsed.inviteToken ? "EMPLOYEE" : "ADMIN",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // If invite token was used, mark it as accepted
  if (parsed.inviteToken) {
    await acceptInvite(parsed.inviteToken);
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.email);

  return { user, token: accessToken, refreshToken };
}

export async function loginUser(input: z.infer<typeof loginSchema>) {
  const parsed = loginSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { email: parsed.email } });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const valid = await bcrypt.compare(parsed.password, user.passwordHash);

  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token: accessToken,
    refreshToken,
  };
}

export async function refreshTokens(refreshToken: string) {
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
      sub: string;
      email: string;
      type: string;
    };

    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.email);

    return {
      user,
      token: accessToken,
      refreshToken: newRefreshToken,
    };
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
}
