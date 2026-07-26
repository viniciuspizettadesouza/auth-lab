import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { session, verification } from "@/db/schema/auth";
import { auth } from "@/services/auth/service";
import { TOTP_REPLAY_WINDOW_SECONDS } from "@/features/link-code/config";

function replayIdentifier(userId: string, code: string) {
  const codeDigest = createHash("sha256").update(code).digest("hex");
  return `totp-use:${userId}:${codeDigest}`;
}

export async function verifyTotpWithReplayDefense(
  request: Request,
  code: string
) {
  const existingSession = await auth.api.getSession({
    headers: request.headers
  });
  const response = await auth.api.verifyTOTP({
    headers: request.headers,
    body: { code, trustDevice: false },
    asResponse: true
  });
  if (!response.ok) return response;

  const data = await response.clone().json() as {
    token: string;
    user: { id: string };
  };
  async function replayResponse() {
    if (!existingSession) {
      await db.delete(session).where(eq(session.token, data.token));
    }
    return Response.json(
      {
        code: "TOTP_REPLAYED",
        message: "This TOTP code was already accepted."
      },
      { status: 409 }
    );
  }
  const key = replayIdentifier(data.user.id, code);
  const [used] = await db
    .select({ id: verification.id })
    .from(verification)
    .where(
      and(
        eq(verification.identifier, key),
        gt(verification.expiresAt, new Date())
      )
    )
    .limit(1);

  if (used) {
    return replayResponse();
  }

  try {
    await db.insert(verification).values({
      id: randomUUID(),
      identifier: key,
      value: data.user.id,
      expiresAt: new Date(Date.now() + TOTP_REPLAY_WINDOW_SECONDS * 1000)
    });
  } catch {
    return replayResponse();
  }
  return response;
}
