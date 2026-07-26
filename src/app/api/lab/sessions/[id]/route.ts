import { NextRequest, NextResponse } from "next/server";

import { revokeOwnedSession } from "@/services/session/service";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const result = await revokeOwnedSession(request.headers, id);
  if (result === "unauthenticated") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (result === "not-found") {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
