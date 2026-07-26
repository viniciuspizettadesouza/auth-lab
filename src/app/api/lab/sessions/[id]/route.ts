import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { session } from "@/db/schema";
import { auth } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const [ownedSession] = await db
    .select({ token: session.token })
    .from(session)
    .where(and(eq(session.id, id), eq(session.userId, current.user.id)))
    .limit(1);

  if (!ownedSession) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  await auth.api.revokeSession({
    headers: request.headers,
    body: { token: ownedSession.token }
  });
  return new NextResponse(null, { status: 204 });
}
