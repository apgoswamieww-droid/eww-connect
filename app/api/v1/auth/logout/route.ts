import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });

  // Clear refresh token cookie
  response.cookies.set({
    name: "refreshToken",
    value: "",
    httpOnly: true,
    maxAge: 0,
  });

  return response;
}
