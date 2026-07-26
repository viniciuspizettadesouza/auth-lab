import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const sessions = await auth.api.listSessions({ headers: request.headers });
  return NextResponse.json({
    sessions: sessions.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      expiresAt: item.expiresAt,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      current: item.id === current.session.id
    }))
  });
}
