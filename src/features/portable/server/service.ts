import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  portableCredential,
  portablePresentationReplay,
  portablePresentationRequest
} from "@/db/schema";
import {
  decodeDisclosures,
  isPortablePublicJwk,
  issuePortableCredential,
  portableDigest,
  presentationDigest,
  verifyHolderProof,
  verifyPortableCredential,
  PORTABLE_VERIFIER,
  type PortableClaimName
} from "@/features/portable/server/protocol";

const SIGNING_SECRET = `${process.env.BETTER_AUTH_SECRET ?? "auth-lab-local-development-only-secret"}:portable-issuer`;
const REQUEST_LIFETIME_MS = 2 * 60_000;

export async function issueCredential(visitorId: string, holderJwk: unknown) {
  if (!isPortablePublicJwk(holderJwk)) return null;
  const issued = issuePortableCredential({ holderJwk, signingSecret: SIGNING_SECRET });
  await db.insert(portableCredential).values({
    id: issued.credentialId,
    visitorId,
    holderThumbprint: issued.holderThumbprint,
    expiresAt: issued.expiresAt
  });
  return {
    credentialId: issued.credentialId,
    disclosures: issued.disclosures,
    expiresAt: issued.expiresAt,
    issuer: "https://issuer.auth-lab.local",
    issuerJwt: issued.issuerJwt,
    format: "auth-lab-sd-jwt-model"
  };
}

export async function createPresentationRequest(input: {
  requestedClaims: PortableClaimName[];
  visitorId: string;
}) {
  const id = randomUUID();
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + REQUEST_LIFETIME_MS);
  await db.insert(portablePresentationRequest).values({
    id,
    visitorId: input.visitorId,
    nonceDigest: portableDigest(nonce),
    audience: PORTABLE_VERIFIER,
    requestedClaims: input.requestedClaims,
    expiresAt
  });
  return { audience: PORTABLE_VERIFIER, expiresAt, nonce, requestId: id, requestedClaims: input.requestedClaims };
}

export async function denyPresentationRequest(visitorId: string, requestId: string) {
  const [denied] = await db.update(portablePresentationRequest)
    .set({ status: "denied", consumedAt: new Date() })
    .where(and(
      eq(portablePresentationRequest.id, requestId),
      eq(portablePresentationRequest.visitorId, visitorId),
      eq(portablePresentationRequest.status, "pending")
    )).returning({ id: portablePresentationRequest.id });
  return Boolean(denied);
}

export async function verifyPresentation(input: {
  disclosures: string[];
  holderProof: string;
  issuerJwt: string;
  nonce: string;
  requestId: string;
  visitorId: string;
}) {
  const [request] = await db.select().from(portablePresentationRequest).where(and(
    eq(portablePresentationRequest.id, input.requestId),
    eq(portablePresentationRequest.visitorId, input.visitorId)
  )).limit(1);
  if (!request || request.status !== "pending") return { ok: false as const, reason: "invalid-or-consumed-request" as const };
  if (request.expiresAt <= new Date()) return { ok: false as const, reason: "expired-request" as const };
  if (portableDigest(input.nonce) !== request.nonceDigest) return { ok: false as const, reason: "invalid-nonce" as const };

  const verifiedCredential = verifyPortableCredential({ issuerJwt: input.issuerJwt, signingSecret: SIGNING_SECRET });
  if (!verifiedCredential.ok) return verifiedCredential;
  const credentialId = verifiedCredential.claims.jti as string;
  const [credential] = await db.select().from(portableCredential).where(and(
    eq(portableCredential.id, credentialId),
    eq(portableCredential.visitorId, input.visitorId),
    eq(portableCredential.status, "active"),
    isNull(portableCredential.revokedAt),
    gt(portableCredential.expiresAt, new Date())
  )).limit(1);
  if (!credential) return { ok: false as const, reason: "revoked-or-unknown-credential" as const };

  const disclosed = decodeDisclosures(input.disclosures, verifiedCredential.claims._sd as string[]);
  if (!disclosed ||
    !request.requestedClaims.every((claim) => claim in disclosed) ||
    !Object.keys(disclosed).every((claim) => request.requestedClaims.includes(claim as PortableClaimName))) {
    return { ok: false as const, reason: "missing-or-invalid-disclosure" as const };
  }
  const holder = verifyHolderProof({
    audience: request.audience,
    expectedThumbprint: credential.holderThumbprint,
    holderProof: input.holderProof,
    nonce: input.nonce,
    presentationHash: presentationDigest(input.issuerJwt, input.disclosures)
  });
  if (!holder.ok) return holder;

  try {
    await db.transaction(async (tx) => {
      const [consumed] = await tx.update(portablePresentationRequest)
        .set({ status: "consumed", consumedAt: new Date() })
        .where(and(
          eq(portablePresentationRequest.id, request.id),
          eq(portablePresentationRequest.status, "pending"),
          gt(portablePresentationRequest.expiresAt, new Date())
        )).returning({ id: portablePresentationRequest.id });
      if (!consumed) throw new Error("request-consumed");
      await tx.insert(portablePresentationReplay).values({
        jti: holder.jti,
        requestId: request.id,
        expiresAt: request.expiresAt
      });
    });
  } catch {
    return { ok: false as const, reason: "replayed-presentation" as const };
  }
  return {
    ok: true as const,
    audience: request.audience,
    disclosed,
    issuer: verifiedCredential.claims.iss,
    subject: verifiedCredential.claims.sub
  };
}

export async function revokeCredential(visitorId: string, credentialId: string) {
  const [revoked] = await db.update(portableCredential)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(
      eq(portableCredential.id, credentialId),
      eq(portableCredential.visitorId, visitorId),
      eq(portableCredential.status, "active")
    )).returning({ id: portableCredential.id });
  return Boolean(revoked);
}
