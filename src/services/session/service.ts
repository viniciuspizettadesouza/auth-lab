import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { session } from "@/db/schema/auth";
import { auth } from "@/services/auth/service";

export async function listSessionSummaries(headers: Headers) {
  const current = await auth.api.getSession({ headers });
  if (!current) return null;

  const sessions = await auth.api.listSessions({ headers });
  return sessions.map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    expiresAt: item.expiresAt,
    ipAddress: item.ipAddress,
    userAgent: item.userAgent,
    current: item.id === current.session.id
  }));
}

export async function revokeOwnedSession(headers: Headers, id: string) {
  const current = await auth.api.getSession({ headers });
  if (!current) return "unauthenticated" as const;

  const [ownedSession] = await db
    .select({ token: session.token })
    .from(session)
    .where(and(eq(session.id, id), eq(session.userId, current.user.id)))
    .limit(1);

  if (!ownedSession) return "not-found" as const;

  await auth.api.revokeSession({
    headers,
    body: { token: ownedSession.token }
  });
  return "revoked" as const;
}
