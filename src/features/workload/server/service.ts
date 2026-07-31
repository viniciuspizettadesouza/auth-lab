import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  workloadAccessGrant,
  workloadApiKey,
  workloadAssertionReplay,
  workloadAuditEvent,
  workloadClientSecret,
  workloadProofReplay,
  workloadPrincipal
} from "@/db/schema";
import {
  createApiKey,
  createClientSecret,
  createPlatformAssertion,
  digestApiKey,
  parseApiKey,
  parseClientSecret,
  verifyPlatformAssertion,
  WORKLOAD_AUDIENCE,
  WORKLOAD_SCOPES
} from "@/features/workload/server/protocol";
import {
  isDpopPublicJwk,
  jwkThumbprint,
  sha256,
  verifyDpopProof,
  type DpopPublicJwk
} from "@/features/session-token/server/dpop";

const KEY_LIFETIME_MS = 365 * 24 * 60 * 60_000;
const ROTATION_OVERLAP_MS = 60_000;
const ACCESS_TOKEN_LIFETIME_MS = 5 * 60_000;
const FEDERATED_TOKEN_LIFETIME_MS = 2 * 60_000;
const PLATFORM_SIGNING_SECRET =
  process.env.WORKLOAD_PLATFORM_SIGNING_SECRET ??
  `${process.env.BETTER_AUTH_SECRET ?? "auth-lab-local-development-only-secret"}:workload-platform`;

async function audit(input: {
  action: string;
  detail: string;
  keyId?: string;
  outcome: "success" | "failure";
  principalId: string;
}) {
  await db.insert(workloadAuditEvent).values({ id: randomUUID(), ...input });
}

export async function createWorkloadPrincipal(visitorId: string, name: string) {
  const principalId = `svc_${randomUUID()}`;
  const generated = createApiKey();
  const expiresAt = new Date(Date.now() + KEY_LIFETIME_MS);
  await db.transaction(async (tx) => {
    await tx.insert(workloadPrincipal).values({
      id: principalId,
      visitorId,
      name,
      audience: WORKLOAD_AUDIENCE,
      scopes: WORKLOAD_SCOPES.join(" ")
    });
    await tx.insert(workloadApiKey).values({
      id: generated.keyId,
      principalId,
      digest: digestApiKey(generated.apiKey),
      hint: generated.hint,
      expiresAt
    });
    await tx.insert(workloadAuditEvent).values({
      id: randomUUID(),
      principalId,
      keyId: generated.keyId,
      action: "key.created",
      outcome: "success",
      detail: "Initial long-lived API key issued; secret returned once."
    });
  });
  return {
    apiKey: generated.apiKey,
    audience: WORKLOAD_AUDIENCE,
    expiresAt,
    keyId: generated.keyId,
    keyHint: generated.hint,
    name,
    principalId,
    scopes: [...WORKLOAD_SCOPES]
  };
}

async function resolveKey(apiKey: string) {
  const parsed = parseApiKey(apiKey);
  if (!parsed) return null;
  const [record] = await db
    .select({
      audience: workloadPrincipal.audience,
      digest: workloadApiKey.digest,
      expiresAt: workloadApiKey.expiresAt,
      keyId: workloadApiKey.id,
      principalId: workloadPrincipal.id,
      principalStatus: workloadPrincipal.status,
      revokedAt: workloadApiKey.revokedAt,
      scopes: workloadPrincipal.scopes,
      visitorId: workloadPrincipal.visitorId
    })
    .from(workloadApiKey)
    .innerJoin(
      workloadPrincipal,
      eq(workloadPrincipal.id, workloadApiKey.principalId)
    )
    .where(eq(workloadApiKey.id, parsed.keyId))
    .limit(1);
  if (!record) return null;
  const actual = Buffer.from(digestApiKey(apiKey));
  const expected = Buffer.from(record.digest);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return record;
}

export async function authorizeApiKey(input: {
  apiKey: string;
  audience: string;
  scope: string;
}) {
  const key = await resolveKey(input.apiKey);
  if (!key) return { ok: false as const, reason: "invalid-key" as const };
  let reason: "expired-key" | "revoked-key" | "wrong-audience" | "insufficient-scope" | null = null;
  if (key.principalStatus !== "active" || key.revokedAt) reason = "revoked-key";
  else if (key.expiresAt <= new Date()) reason = "expired-key";
  else if (key.audience !== input.audience) reason = "wrong-audience";
  else if (!key.scopes.split(" ").includes(input.scope)) reason = "insufficient-scope";
  await audit({
    action: "resource.access",
    detail: reason ?? `Authorized ${input.scope} for the exact configured audience.`,
    keyId: key.keyId,
    outcome: reason ? "failure" : "success",
    principalId: key.principalId
  });
  return reason
    ? { ok: false as const, reason }
    : { ok: true as const, keyId: key.keyId, principalId: key.principalId, scope: input.scope };
}

export async function rotateApiKey(visitorId: string, apiKey: string) {
  const current = await resolveKey(apiKey);
  if (
    !current ||
    current.visitorId !== visitorId ||
    current.principalStatus !== "active" ||
    current.revokedAt ||
    current.expiresAt <= new Date()
  ) return null;
  const generated = createApiKey();
  const expiresAt = new Date(Date.now() + KEY_LIFETIME_MS);
  const overlapEndsAt = new Date(Date.now() + ROTATION_OVERLAP_MS);
  await db.transaction(async (tx) => {
    await tx
      .update(workloadApiKey)
      .set({ expiresAt: overlapEndsAt })
      .where(eq(workloadApiKey.id, current.keyId));
    await tx.insert(workloadApiKey).values({
      id: generated.keyId,
      principalId: current.principalId,
      digest: digestApiKey(generated.apiKey),
      hint: generated.hint,
      expiresAt
    });
    await tx.insert(workloadAuditEvent).values({
      id: randomUUID(),
      principalId: current.principalId,
      keyId: generated.keyId,
      action: "key.rotated",
      outcome: "success",
      detail: "Replacement issued; previous key retained for a 60-second overlap."
    });
  });
  return {
    apiKey: generated.apiKey,
    expiresAt,
    keyId: generated.keyId,
    keyHint: generated.hint,
    overlapEndsAt,
    principalId: current.principalId
  };
}

export async function revokeApiKey(visitorId: string, apiKey: string) {
  const current = await resolveKey(apiKey);
  if (!current || current.visitorId !== visitorId || current.revokedAt) return false;
  const [revoked] = await db
    .update(workloadApiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(workloadApiKey.id, current.keyId), isNull(workloadApiKey.revokedAt)))
    .returning({ id: workloadApiKey.id });
  if (!revoked) return false;
  await audit({
    action: "key.revoked",
    detail: "API key revoked; subsequent bearer use must fail.",
    keyId: current.keyId,
    outcome: "success",
    principalId: current.principalId
  });
  return true;
}

export async function listWorkloadAudit(visitorId: string, principalId: string) {
  return db
    .select({
      action: workloadAuditEvent.action,
      createdAt: workloadAuditEvent.createdAt,
      detail: workloadAuditEvent.detail,
      keyId: workloadAuditEvent.keyId,
      outcome: workloadAuditEvent.outcome
    })
    .from(workloadAuditEvent)
    .innerJoin(
      workloadPrincipal,
      eq(workloadPrincipal.id, workloadAuditEvent.principalId)
    )
    .where(
      and(
        eq(workloadAuditEvent.principalId, principalId),
        eq(workloadPrincipal.visitorId, visitorId)
      )
    )
    .orderBy(desc(workloadAuditEvent.createdAt))
    .limit(30);
}

async function ownedPrincipal(visitorId: string, principalId: string) {
  const [principal] = await db
    .select()
    .from(workloadPrincipal)
    .where(and(
      eq(workloadPrincipal.id, principalId),
      eq(workloadPrincipal.visitorId, visitorId),
      eq(workloadPrincipal.status, "active")
    ))
    .limit(1);
  return principal ?? null;
}

export async function issueClientSecret(visitorId: string, principalId: string) {
  const principal = await ownedPrincipal(visitorId, principalId);
  if (!principal) return null;
  const generated = createClientSecret();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60_000);
  await db.transaction(async (tx) => {
    await tx.insert(workloadClientSecret).values({
      id: generated.secretId,
      principalId,
      digest: digestApiKey(generated.clientSecret),
      hint: generated.hint,
      expiresAt
    });
    await tx.insert(workloadAuditEvent).values({
      id: randomUUID(), principalId, keyId: null,
      action: "client-secret.created", outcome: "success",
      detail: "OAuth client secret issued for one-time display."
    });
  });
  return { ...generated, clientId: principalId, expiresAt };
}

async function resolveClientSecret(clientId: string, clientSecret: string) {
  const parsed = parseClientSecret(clientSecret);
  if (!parsed) return null;
  const [record] = await db
    .select({
      audience: workloadPrincipal.audience,
      digest: workloadClientSecret.digest,
      expiresAt: workloadClientSecret.expiresAt,
      principalId: workloadPrincipal.id,
      principalStatus: workloadPrincipal.status,
      revokedAt: workloadClientSecret.revokedAt,
      scopes: workloadPrincipal.scopes,
      secretId: workloadClientSecret.id,
      visitorId: workloadPrincipal.visitorId
    })
    .from(workloadClientSecret)
    .innerJoin(workloadPrincipal, eq(workloadPrincipal.id, workloadClientSecret.principalId))
    .where(and(
      eq(workloadClientSecret.id, parsed.secretId),
      eq(workloadPrincipal.id, clientId)
    ))
    .limit(1);
  if (!record) return null;
  const actual = Buffer.from(digestApiKey(clientSecret));
  const expected = Buffer.from(record.digest);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? record : null;
}

async function createAccessGrant(input: {
  audience: string;
  lifetimeMs: number;
  principalId: string;
  publicJwk?: DpopPublicJwk;
  scope: string;
  source: "client-credentials" | "workload-federation";
}) {
  const accessToken = randomUUID() + randomUUID();
  const expiresAt = new Date(Date.now() + input.lifetimeMs);
  const id = randomUUID();
  await db.insert(workloadAccessGrant).values({
    id,
    principalId: input.principalId,
    tokenDigest: sha256(accessToken),
    audience: input.audience,
    scope: input.scope,
    source: input.source,
    publicJwk: input.publicJwk,
    keyThumbprint: input.publicJwk ? jwkThumbprint(input.publicJwk) : null,
    expiresAt
  });
  await audit({
    action: "access-token.issued",
    detail: `${input.source} issued a ${input.publicJwk ? "sender-constrained" : "bearer"} token for ${input.scope}.`,
    outcome: "success",
    principalId: input.principalId
  });
  return { accessToken, expiresAt, tokenType: input.publicJwk ? "DPoP" as const : "Bearer" as const };
}

export async function exchangeClientCredentials(input: {
  audience: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}) {
  const credential = await resolveClientSecret(input.clientId, input.clientSecret);
  if (!credential) return { ok: false as const, reason: "invalid-client" as const };
  if (credential.principalStatus !== "active" || credential.revokedAt || credential.expiresAt <= new Date()) {
    return { ok: false as const, reason: "invalid-client" as const };
  }
  if (credential.audience !== input.audience) return { ok: false as const, reason: "invalid-target" as const };
  if (!credential.scopes.split(" ").includes(input.scope)) return { ok: false as const, reason: "invalid-scope" as const };
  return { ok: true as const, ...(await createAccessGrant({
    audience: input.audience,
    lifetimeMs: ACCESS_TOKEN_LIFETIME_MS,
    principalId: credential.principalId,
    scope: input.scope,
    source: "client-credentials"
  })) };
}

export async function rotateClientSecret(visitorId: string, clientId: string, currentSecret: string) {
  const current = await resolveClientSecret(clientId, currentSecret);
  if (!current || current.visitorId !== visitorId || current.revokedAt || current.expiresAt <= new Date()) return null;
  const generated = createClientSecret();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60_000);
  await db.transaction(async (tx) => {
    await tx.update(workloadClientSecret)
      .set({ expiresAt: new Date(Date.now() + ROTATION_OVERLAP_MS) })
      .where(eq(workloadClientSecret.id, current.secretId));
    await tx.insert(workloadClientSecret).values({
      id: generated.secretId, principalId: clientId,
      digest: digestApiKey(generated.clientSecret), hint: generated.hint, expiresAt
    });
    await tx.insert(workloadAuditEvent).values({
      id: randomUUID(), principalId: clientId, action: "client-secret.rotated",
      outcome: "success", detail: "OAuth client secret rotated with a 60-second overlap."
    });
  });
  return { ...generated, clientId, expiresAt };
}

export async function issueSyntheticPlatformAssertion(input: {
  audience: string;
  principalId: string;
  visitorId: string;
}) {
  if (!(await ownedPrincipal(input.visitorId, input.principalId))) return null;
  const assertion = createPlatformAssertion({
    audience: input.audience,
    principalId: input.principalId,
    signingSecret: PLATFORM_SIGNING_SECRET
  });
  await audit({
    action: "platform.attested",
    detail: "Synthetic platform issuer signed a 60-second workload assertion.",
    outcome: "success",
    principalId: input.principalId
  });
  return assertion;
}

export async function exchangeWorkloadAssertion(input: {
  assertion: string;
  audience: string;
  publicJwk: unknown;
  scope: string;
  tokenEndpoint: string;
}) {
  if (!isDpopPublicJwk(input.publicJwk)) return { ok: false as const, reason: "invalid-key" as const };
  const verified = verifyPlatformAssertion({
    assertion: input.assertion,
    audience: input.tokenEndpoint,
    signingSecret: PLATFORM_SIGNING_SECRET
  });
  if (!verified.ok) return verified;
  const [principal] = await db.select().from(workloadPrincipal)
    .where(and(eq(workloadPrincipal.id, verified.principalId), eq(workloadPrincipal.status, "active")))
    .limit(1);
  if (!principal || principal.audience !== input.audience) return { ok: false as const, reason: "invalid-target" as const };
  if (!principal.scopes.split(" ").includes(input.scope)) return { ok: false as const, reason: "invalid-scope" as const };
  try {
    await db.insert(workloadAssertionReplay).values({
      jti: verified.jti, principalId: principal.id, expiresAt: verified.expiresAt
    });
  } catch {
    return { ok: false as const, reason: "replayed-assertion" as const };
  }
  return { ok: true as const, ...(await createAccessGrant({
    audience: input.audience,
    lifetimeMs: FEDERATED_TOKEN_LIFETIME_MS,
    principalId: principal.id,
    publicJwk: input.publicJwk,
    scope: input.scope,
    source: "workload-federation"
  })) };
}

export async function consumeWorkloadAccessToken(input: {
  accessToken: string;
  audience: string;
  authScheme: "Bearer" | "DPoP";
  method: string;
  proof?: string;
  scope: string;
  uri: string;
}) {
  const [grant] = await db.select().from(workloadAccessGrant).where(and(
    eq(workloadAccessGrant.tokenDigest, sha256(input.accessToken)),
    eq(workloadAccessGrant.audience, input.audience),
    eq(workloadAccessGrant.scope, input.scope),
    gt(workloadAccessGrant.expiresAt, new Date()),
    isNull(workloadAccessGrant.revokedAt)
  )).limit(1);
  if (!grant) return { ok: false as const, reason: "invalid-token" as const };
  if (grant.keyThumbprint) {
    if (input.authScheme !== "DPoP") return { ok: false as const, reason: "invalid-token-type" as const };
    if (!input.proof) return { ok: false as const, reason: "proof-required" as const };
    const verified = verifyDpopProof({
      accessToken: input.accessToken,
      expectedMethod: input.method,
      expectedThumbprint: grant.keyThumbprint,
      expectedUri: input.uri,
      proof: input.proof
    });
    if (!verified.ok) return verified;
    try {
      await db.insert(workloadProofReplay).values({
        jti: verified.jti, grantId: grant.id, expiresAt: grant.expiresAt
      });
    } catch {
      return { ok: false as const, reason: "replayed-proof" as const };
    }
  } else if (input.authScheme !== "Bearer") return { ok: false as const, reason: "invalid-token-type" as const };
  await audit({
    action: "token.resource-access",
    detail: `${grant.source} token authorized ${grant.scope}.`,
    outcome: "success",
    principalId: grant.principalId
  });
  return { ok: true as const, principalId: grant.principalId, source: grant.source };
}

export async function revokeWorkloadGrants(visitorId: string, principalId: string) {
  if (!(await ownedPrincipal(visitorId, principalId))) return false;
  await db.update(workloadAccessGrant).set({ revokedAt: new Date() })
    .where(and(eq(workloadAccessGrant.principalId, principalId), isNull(workloadAccessGrant.revokedAt)));
  await audit({
    action: "access-token.revoked", detail: "All active workload grants were revoked.",
    outcome: "success", principalId
  });
  return true;
}
