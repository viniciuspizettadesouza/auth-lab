import "server-only";

import { randomUUID } from "node:crypto";

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture
} from "@simplewebauthn/server";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  passkey,
  passkeyKind,
  webauthnChallenge
} from "@/db/schema";
import {
  WEBAUTHN_CHALLENGE_TTL_SECONDS,
  webauthnRelyingParty
} from "@/features/passkey/server/config";
import { recordPhishingResistantAssurance } from "@/features/session-token/server/risk";

export type StepUpFailure =
  | "expired-or-replayed"
  | "invalid-credential"
  | "invalid-origin"
  | "invalid-proof"
  | "no-security-key";

function transports(value: string | null) {
  return value
    ? (value.split(",") as AuthenticatorTransportFuture[])
    : undefined;
}

export async function createSecurityKeyStepUp(userId: string) {
  const credentials = await db
    .select({
      credentialID: passkey.credentialID,
      transports: passkey.transports
    })
    .from(passkey)
    .innerJoin(
      passkeyKind,
      and(
        eq(passkeyKind.credentialID, passkey.credentialID),
        eq(passkeyKind.kind, "security-key")
      )
    )
    .where(eq(passkey.userId, userId));

  if (!credentials.length) {
    return { ok: false as const, reason: "no-security-key" as const };
  }

  const relyingParty = webauthnRelyingParty();
  const options = await generateAuthenticationOptions({
    rpID: relyingParty.rpID,
    userVerification: "required",
    allowCredentials: credentials.map((credential) => ({
      id: credential.credentialID,
      transports: transports(credential.transports)
    }))
  });
  const id = randomUUID();
  const expiresAt = new Date(
    Date.now() + WEBAUTHN_CHALLENGE_TTL_SECONDS * 1_000
  );
  await db.transaction(async (tx) => {
    await tx
      .delete(webauthnChallenge)
      .where(
        and(
          eq(webauthnChallenge.userId, userId),
          eq(webauthnChallenge.purpose, "security-key-step-up")
        )
      );
    await tx.insert(webauthnChallenge).values({
      id,
      challenge: options.challenge,
      userId,
      purpose: "security-key-step-up",
      expiresAt
    });
  });
  return { ok: true as const, id, expiresAt, options };
}

export async function verifySecurityKeyStepUp({
  challengeId,
  origin,
  response,
  userId,
  sessionId
}: {
  challengeId: string;
  origin: string | null;
  response: AuthenticationResponseJSON;
  userId: string;
  sessionId?: string;
}) {
  const relyingParty = webauthnRelyingParty();
  if (origin !== relyingParty.origin) {
    return { ok: false as const, reason: "invalid-origin" as const };
  }

  const [challenge] = await db
    .update(webauthnChallenge)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(webauthnChallenge.id, challengeId),
        eq(webauthnChallenge.userId, userId),
        eq(webauthnChallenge.purpose, "security-key-step-up"),
        gt(webauthnChallenge.expiresAt, new Date()),
        isNull(webauthnChallenge.consumedAt)
      )
    )
    .returning();
  if (!challenge) {
    return { ok: false as const, reason: "expired-or-replayed" as const };
  }

  const [credential] = await db
    .select({
      id: passkey.id,
      credentialID: passkey.credentialID,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
      transports: passkey.transports
    })
    .from(passkey)
    .innerJoin(
      passkeyKind,
      and(
        eq(passkeyKind.credentialID, passkey.credentialID),
        eq(passkeyKind.kind, "security-key")
      )
    )
    .where(
      and(
        eq(passkey.userId, userId),
        eq(passkey.credentialID, response.id)
      )
    )
    .limit(1);
  if (!credential) {
    return { ok: false as const, reason: "invalid-credential" as const };
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: relyingParty.origin,
      expectedRPID: relyingParty.rpID,
      credential: {
        id: credential.credentialID,
        publicKey: Buffer.from(credential.publicKey, "base64"),
        counter: credential.counter,
        transports: transports(credential.transports)
      },
      requireUserVerification: true
    });
    if (!verification.verified || !verification.authenticationInfo.userVerified) {
      return { ok: false as const, reason: "invalid-proof" as const };
    }
    await db
      .update(passkey)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(passkey.id, credential.id));
    if (sessionId) {
      await recordPhishingResistantAssurance(sessionId, userId);
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "invalid-proof" as const };
  }
}
