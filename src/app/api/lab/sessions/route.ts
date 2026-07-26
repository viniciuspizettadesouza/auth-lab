import { NextRequest, NextResponse } from "next/server";

import { listSessionSummaries } from "@/services/session/service";

export async function GET(request: NextRequest) {
  const sessions = await listSessionSummaries(request.headers);
  if (!sessions) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({ sessions });
}
