import { NextResponse } from "next/server";
import { searchMessages } from "../../../../lib/data/chat";
import { errorResponse, requireAuth } from "../../../../lib/apiAuth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.length < 2) {
      return NextResponse.json({ success: false, error: "Query must be at least 2 characters" }, { status: 400 });
    }

    const results = await searchMessages(session.userId, q);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return errorResponse(error, "Failed to search messages");
  }
}
