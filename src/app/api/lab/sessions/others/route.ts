import { NextRequest, NextResponse } from "next/server";

import { revokeOtherOwnedSessions } from "@/services/session/service";

export async function DELETE(request: NextRequest) {
  const result = await revokeOtherOwnedSessions(request.headers);
  if (result === "unauthenticated") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (result === "not-fresh") {
    return NextResponse.json(
      { error: "A fresh sign-in is required before revoking other sessions." },
      { status: 403 }
    );
  }
  return NextResponse.json({ revoked: result.count });
}
