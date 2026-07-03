import { NextResponse } from "next/server";
import { signupSchema, signupUser } from "../../../../auth/auth";
import { checkRateLimit } from "../../../../lib/rateLimit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    if (!checkRateLimit(`signup:${ip}`, 5, 60000)) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
    const body = await request.json();
    const result = signupSchema.parse(body);
    const data = await signupUser(result);

    const response = NextResponse.json({ success: true, data });
    
    // Store refresh token in httpOnly cookie for security
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
        error: error instanceof Error ? error.message : "Signup failed",
      },
      { status: 400 },
    );
  }
}
