import "server-only";

import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify
} from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { dpopAccessGrant, dpopProofReplay } from "@/db/schema";

export type DpopPublicJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

type DpopHeader = {
  typ?: unknown;
  alg?: unknown;
  jwk?: unknown;
};

type DpopClaims = {
  htm?: unknown;
  htu?: unknown;
  iat?: unknown;
  jti?: unknown;
  ath?: unknown;
};

const grantLifetimeMs = 5 * 60 * 1_000;
const proofClockSkewSeconds = 60;

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export function sha256(value: string) {
  return base64Url(createHash("sha256").update(value).digest());
}

export function isDpopPublicJwk(value: unknown): value is DpopPublicJwk {
  if (!value || typeof value !== "object") return false;
  const jwk = value as Record<string, unknown>;
  return (
    jwk.kty === "EC" &&
    jwk.crv === "P-256" &&
    typeof jwk.x === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(jwk.x) &&
    typeof jwk.y === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(jwk.y)
  );
}

export function jwkThumbprint(jwk: DpopPublicJwk) {
  return sha256(
    JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })
  );
}

function parseSegment<T>(segment: string): T | null {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function verifyDpopProof({
  accessToken,
  expectedMethod,
  expectedUri,
  expectedThumbprint,
  now = Date.now(),
  proof
}: {
  accessToken: string;
  expectedMethod: string;
  expectedUri: string;
  expectedThumbprint: string;
  now?: number;
  proof: string;
}) {
  const parts = proof.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "invalid-proof" as const };
  const [encodedHeader = "", encodedClaims = "", encodedSignature = ""] = parts;
  const header = parseSegment<DpopHeader>(encodedHeader);
  const claims = parseSegment<DpopClaims>(encodedClaims);
  if (
    !header ||
    header.typ !== "dpop+jwt" ||
    header.alg !== "ES256" ||
    !isDpopPublicJwk(header.jwk) ||
    !claims ||
    claims.htm !== expectedMethod.toUpperCase() ||
    claims.htu !== expectedUri ||
    claims.ath !== sha256(accessToken) ||
    typeof claims.jti !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(claims.jti) ||
    typeof claims.iat !== "number" ||
    Math.abs(Math.floor(now / 1_000) - claims.iat) > proofClockSkewSeconds ||
    jwkThumbprint(header.jwk) !== expectedThumbprint
  ) {
    return { ok: false as const, reason: "invalid-proof" as const };
  }

  try {
    const key = createPublicKey({ key: header.jwk, format: "jwk" });
    const valid = verify(
      "sha256",
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      { key, dsaEncoding: "ieee-p1363" },
      Buffer.from(encodedSignature, "base64url")
    );
    return valid
      ? { ok: true as const, jti: claims.jti }
      : { ok: false as const, reason: "invalid-proof" as const };
  } catch {
    return { ok: false as const, reason: "invalid-proof" as const };
  }
}

export async function issueDpopGrant({
  publicJwk,
  sessionId,
  userId
}: {
  publicJwk: DpopPublicJwk;
  sessionId: string;
  userId: string;
}) {
  const accessToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + grantLifetimeMs);
  await db.insert(dpopAccessGrant).values({
    id: randomUUID(),
    userId,
    sessionId,
    tokenDigest: sha256(accessToken),
    publicJwk,
    keyThumbprint: jwkThumbprint(publicJwk),
    expiresAt
  });
  return { accessToken, expiresAt };
}

export async function consumeDpopGrant({
  accessToken,
  method,
  proof,
  uri
}: {
  accessToken: string;
  method: string;
  proof: string;
  uri: string;
}) {
  const [grant] = await db
    .select()
    .from(dpopAccessGrant)
    .where(
      and(
        eq(dpopAccessGrant.tokenDigest, sha256(accessToken)),
        gt(dpopAccessGrant.expiresAt, new Date()),
        isNull(dpopAccessGrant.revokedAt)
      )
    )
    .limit(1);
  if (!grant) return { ok: false as const, reason: "invalid-token" as const };

  const verification = verifyDpopProof({
    accessToken,
    expectedMethod: method,
    expectedThumbprint: grant.keyThumbprint,
    expectedUri: uri,
    proof
  });
  if (!verification.ok) return verification;

  try {
    await db.insert(dpopProofReplay).values({
      jti: verification.jti,
      grantId: grant.id,
      expiresAt: grant.expiresAt
    });
  } catch {
    return { ok: false as const, reason: "replayed-proof" as const };
  }
  return { ok: true as const, userId: grant.userId };
}
