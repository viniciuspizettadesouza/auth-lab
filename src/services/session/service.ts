import "server-only";

import { and, eq, ne } from "drizzle-orm";

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

export const sessionPolicy = {
  absoluteLifetimeSeconds: 60 * 60 * 24 * 7,
  slidingRenewalSeconds: 60 * 60 * 24,
  freshAuthenticationSeconds: 60 * 30,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/"
  },
  fixationDefense:
    "Authentication creates a new random server-side session instead of adopting a browser-supplied identifier."
} as const;

export async function sessionLabState(headers: Headers) {
  const current = await auth.api.getSession({ headers });
  if (!current) return null;
  return {
    sessions: await listSessionSummaries(headers),
    policy: sessionPolicy,
    current: {
      id: current.session.id,
      freshUntil: new Date(
        new Date(current.session.createdAt).getTime() +
          sessionPolicy.freshAuthenticationSeconds * 1_000
      ).toISOString()
    }
  };
}

export async function revokeOtherOwnedSessions(headers: Headers) {
  const current = await auth.api.getSession({ headers });
  if (!current) return "unauthenticated" as const;
  const freshUntil =
    new Date(current.session.createdAt).getTime() +
    sessionPolicy.freshAuthenticationSeconds * 1_000;
  if (freshUntil <= Date.now()) return "not-fresh" as const;

  const revoked = await db
    .delete(session)
    .where(
      and(
        eq(session.userId, current.user.id),
        ne(session.id, current.session.id)
      )
    )
    .returning({ id: session.id });
  return { status: "revoked" as const, count: revoked.length };
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
