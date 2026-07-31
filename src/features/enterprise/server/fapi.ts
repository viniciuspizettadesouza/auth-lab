import "server-only";

import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify
} from "node:crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  clientAssertionReplay,
  highAssuranceAccessGrant,
  highAssuranceClient
} from "@/db/schema";

export type EnterprisePublicJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

type AssertionHeader = { alg?: unknown; kid?: unknown; typ?: unknown };
type AssertionClaims = {
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  jti?: unknown;
  sub?: unknown;
};

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

export function digest(value: string) {
  return base64Url(createHash("sha256").update(value).digest());
}

export function isEnterprisePublicJwk(value: unknown): value is EnterprisePublicJwk {
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

function certificateThumbprint() {
  return digest(randomBytes(32).toString("base64url"));
}

function parse<T>(segment: string) {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function registerHighAssuranceClient(publicJwk: EnterprisePublicJwk) {
  const id = `fapi-${randomUUID()}`;
  const thumbprint = certificateThumbprint();
  await db.insert(highAssuranceClient).values({
    id,
    name: "Auth Lab regulated client",
    publicJwk,
    activeCertificateThumbprint: thumbprint
  });
  return { clientId: id, certificateThumbprint: thumbprint };
}

export async function authenticatePrivateKeyClient(input: {
  assertion: string;
  audience: string;
  certificateThumbprint: string;
  clientId: string;
  now?: number;
}) {
  const [client] = await db
    .select()
    .from(highAssuranceClient)
    .where(eq(highAssuranceClient.id, input.clientId))
    .limit(1);
  if (!client || client.certificateStatus !== "active") {
    return { ok: false as const, reason: "invalid-client" as const };
  }
  if (client.activeCertificateThumbprint !== input.certificateThumbprint) {
    return { ok: false as const, reason: "certificate-mismatch" as const };
  }

  const parts = input.assertion.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "invalid-assertion" as const };
  const [encodedHeader = "", encodedClaims = "", encodedSignature = ""] = parts;
  const header = parse<AssertionHeader>(encodedHeader);
  const claims = parse<AssertionClaims>(encodedClaims);
  const seconds = Math.floor((input.now ?? Date.now()) / 1_000);
  if (
    !header ||
    header.alg !== "ES256" ||
    header.typ !== "JWT" ||
    header.kid !== client.id ||
    !claims ||
    claims.iss !== client.id ||
    claims.sub !== client.id ||
    claims.aud !== input.audience ||
    typeof claims.iat !== "number" ||
    claims.iat > seconds + 30 ||
    claims.iat < seconds - 60 ||
    typeof claims.exp !== "number" ||
    claims.exp <= seconds ||
    claims.exp > seconds + 120 ||
    typeof claims.jti !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(claims.jti)
  ) {
    return { ok: false as const, reason: "invalid-assertion" as const };
  }
  try {
    const valid = verify(
      "sha256",
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      {
        key: createPublicKey({ key: client.publicJwk, format: "jwk" }),
        dsaEncoding: "ieee-p1363"
      },
      Buffer.from(encodedSignature, "base64url")
    );
    if (!valid) return { ok: false as const, reason: "invalid-assertion" as const };
    await db.insert(clientAssertionReplay).values({
      jti: claims.jti,
      clientId: client.id,
      expiresAt: new Date(claims.exp * 1_000)
    });
  } catch {
    return { ok: false as const, reason: "invalid-or-replayed-assertion" as const };
  }

  const accessToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await db.insert(highAssuranceAccessGrant).values({
    id: randomUUID(),
    clientId: client.id,
    tokenDigest: digest(accessToken),
    certificateThumbprint: client.activeCertificateThumbprint,
    scope: "regulated.read",
    expiresAt
  });
  return {
    ok: true as const,
    accessToken,
    certificateThumbprint: client.activeCertificateThumbprint,
    expiresAt,
    scope: "regulated.read"
  };
}

export async function authenticateCertificateManagement(input: {
  assertion: string;
  audience: string;
  certificateThumbprint: string;
  clientId: string;
}) {
  const result = await authenticatePrivateKeyClient(input);
  if (!result.ok) return result;
  await db
    .update(highAssuranceAccessGrant)
    .set({ revokedAt: new Date() })
    .where(eq(highAssuranceAccessGrant.tokenDigest, digest(result.accessToken)));
  return { ok: true as const };
}

export async function consumeCertificateBoundToken(input: {
  accessToken: string;
  certificateThumbprint: string;
}) {
  const now = new Date();
  const [grant] = await db
    .select({
      clientId: highAssuranceAccessGrant.clientId,
      grantThumbprint: highAssuranceAccessGrant.certificateThumbprint,
      scope: highAssuranceAccessGrant.scope,
      activeThumbprint: highAssuranceClient.activeCertificateThumbprint,
      previousThumbprint: highAssuranceClient.previousCertificateThumbprint,
      overlapEndsAt: highAssuranceClient.overlapEndsAt,
      certificateStatus: highAssuranceClient.certificateStatus
    })
    .from(highAssuranceAccessGrant)
    .innerJoin(
      highAssuranceClient,
      eq(highAssuranceClient.id, highAssuranceAccessGrant.clientId)
    )
    .where(
      and(
        eq(highAssuranceAccessGrant.tokenDigest, digest(input.accessToken)),
        eq(highAssuranceAccessGrant.certificateThumbprint, input.certificateThumbprint),
        gt(highAssuranceAccessGrant.expiresAt, now),
        isNull(highAssuranceAccessGrant.revokedAt),
        eq(highAssuranceClient.certificateStatus, "active"),
        or(
          eq(highAssuranceClient.activeCertificateThumbprint, input.certificateThumbprint),
          and(
            eq(highAssuranceClient.previousCertificateThumbprint, input.certificateThumbprint),
            gt(highAssuranceClient.overlapEndsAt, now)
          )
        )
      )
    )
    .limit(1);
  return grant ?? null;
}

export async function rotateCertificate(clientId: string) {
  const [client] = await db
    .select()
    .from(highAssuranceClient)
    .where(eq(highAssuranceClient.id, clientId))
    .limit(1);
  if (!client || client.certificateStatus !== "active") return null;
  const activeCertificateThumbprint = certificateThumbprint();
  const overlapEndsAt = new Date(Date.now() + 5 * 60_000);
  await db
    .update(highAssuranceClient)
    .set({
      activeCertificateThumbprint,
      previousCertificateThumbprint: client.activeCertificateThumbprint,
      overlapEndsAt,
      updatedAt: new Date()
    })
    .where(eq(highAssuranceClient.id, clientId));
  return {
    activeCertificateThumbprint,
    previousCertificateThumbprint: client.activeCertificateThumbprint,
    overlapEndsAt
  };
}

export async function revokeCertificate(clientId: string) {
  const [client] = await db
    .update(highAssuranceClient)
    .set({ certificateStatus: "revoked", updatedAt: new Date() })
    .where(eq(highAssuranceClient.id, clientId))
    .returning({ id: highAssuranceClient.id });
  if (!client) return false;
  await db
    .update(highAssuranceAccessGrant)
    .set({ revokedAt: new Date() })
    .where(eq(highAssuranceAccessGrant.clientId, clientId));
  return true;
}
