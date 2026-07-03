import { NextResponse } from "next/server";
import { refreshTokens } from "../../../../auth/auth";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: "No refresh token found" },
        { status: 401 },
      );
    }

    const data = await refreshTokens(refreshToken);

    const response = NextResponse.json({ success: true, data });

    // Update refresh token cookie with new one
    response.cookies.set({
      name: "refreshToken",
      value: data.refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Token refresh failed",
      },
      { status: 401 },
    );
  }
}
