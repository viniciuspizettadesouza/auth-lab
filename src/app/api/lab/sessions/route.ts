import { NextRequest, NextResponse } from "next/server";

import { sessionLabState } from "@/services/session/service";

export async function GET(request: NextRequest) {
  const state = await sessionLabState(request.headers);
  if (!state) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json(state);
}
