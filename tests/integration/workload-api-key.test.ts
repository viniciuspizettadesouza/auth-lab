import {
  generateKeyPairSync,
  randomUUID,
  sign,
  type JsonWebKey
} from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WORKLOAD_AUDIENCE } from "@/features/workload/server/protocol";
import { sha256, type DpopPublicJwk } from "@/features/session-token/server/dpop";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("workload API key lifecycle", () => {
  let database: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let service: typeof import("@/features/workload/server/service");
  const visitorId = `test-visitor-${randomUUID()}`;
  let principalId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    database = await import("@/db");
    schema = await import("@/db/schema");
    service = await import("@/features/workload/server/service");
  });

  afterAll(async () => {
    if (principalId) {
      await database.db.delete(schema.workloadPrincipal).where(eq(schema.workloadPrincipal.id, principalId));
    }
    await database.sqlClient.end({ timeout: 5 });
  });

  it("keeps the machine principal separate and stores only a key digest", async () => {
    const created = await service.createWorkloadPrincipal(visitorId, "integration-worker");
    principalId = created.principalId;
    expect(created.apiKey).toMatch(/^ak_lab_/);
    expect(created.scopes).toContain("orders.read");

    const [stored] = await database.db
      .select()
      .from(schema.workloadApiKey)
      .where(eq(schema.workloadApiKey.id, created.keyId));
    expect(stored?.digest).not.toContain(created.apiKey);
    expect(stored?.hint).not.toContain(created.apiKey.split(".")[1]);

    await expect(service.authorizeApiKey({
      apiKey: created.apiKey,
      audience: WORKLOAD_AUDIENCE,
      scope: "orders.read"
    })).resolves.toMatchObject({ ok: true, principalId });
    await expect(service.authorizeApiKey({
      apiKey: created.apiKey,
      audience: "https://api.auth-lab.local/billing",
      scope: "orders.read"
    })).resolves.toEqual({ ok: false, reason: "wrong-audience" });
    await expect(service.authorizeApiKey({
      apiKey: created.apiKey,
      audience: WORKLOAD_AUDIENCE,
      scope: "billing.admin"
    })).resolves.toEqual({ ok: false, reason: "insufficient-scope" });

    expect(await service.rotateApiKey("different-owner", created.apiKey)).toBeNull();
    const rotated = await service.rotateApiKey(visitorId, created.apiKey);
    expect(rotated?.apiKey).not.toBe(created.apiKey);
    expect(rotated?.overlapEndsAt.getTime()).toBeGreaterThan(Date.now());
    expect(rotated && await service.revokeApiKey(visitorId, rotated.apiKey)).toBe(true);
    await expect(service.authorizeApiKey({
      apiKey: rotated?.apiKey ?? "",
      audience: WORKLOAD_AUDIENCE,
      scope: "orders.read"
    })).resolves.toEqual({ ok: false, reason: "revoked-key" });

    const audit = await service.listWorkloadAudit(visitorId, principalId);
    expect(audit.map((event) => event.action)).toEqual(expect.arrayContaining([
      "key.created", "resource.access", "key.rotated", "key.revoked"
    ]));
    expect(JSON.stringify(audit)).not.toContain(created.apiKey);
    expect(await service.listWorkloadAudit("different-owner", principalId)).toEqual([]);
  });

  it("exchanges client credentials and consumes platform assertions once", async () => {
    const credential = await service.issueClientSecret(visitorId, principalId);
    expect(credential?.clientSecret).toMatch(/^cs_lab_/);
    if (!credential) throw new Error("No client credential.");
    expect(await service.exchangeClientCredentials({
      audience: WORKLOAD_AUDIENCE,
      clientId: principalId,
      clientSecret: `${credential.clientSecret}x`,
      scope: "orders.read"
    })).toEqual({ ok: false, reason: "invalid-client" });
    const clientGrant = await service.exchangeClientCredentials({
      audience: WORKLOAD_AUDIENCE,
      clientId: principalId,
      clientSecret: credential.clientSecret,
      scope: "orders.read"
    });
    expect(clientGrant.ok).toBe(true);
    if (!clientGrant.ok) throw new Error("No client grant.");
    expect(await service.consumeWorkloadAccessToken({
      accessToken: clientGrant.accessToken,
      audience: WORKLOAD_AUDIENCE,
      authScheme: "Bearer",
      method: "GET",
      scope: "orders.read",
      uri: "https://app.example/resource"
    })).toMatchObject({ ok: true, source: "client-credentials" });

    const tokenEndpoint = "https://app.example/federation/token";
    const assertion = await service.issueSyntheticPlatformAssertion({
      audience: tokenEndpoint,
      principalId,
      visitorId
    });
    if (!assertion) throw new Error("No platform assertion.");
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey as DpopPublicJwk;
    const federated = await service.exchangeWorkloadAssertion({
      assertion,
      audience: WORKLOAD_AUDIENCE,
      publicJwk,
      scope: "orders.read",
      tokenEndpoint
    });
    expect(federated.ok).toBe(true);
    expect(await service.exchangeWorkloadAssertion({
      assertion,
      audience: WORKLOAD_AUDIENCE,
      publicJwk,
      scope: "orders.read",
      tokenEndpoint
    })).toEqual({ ok: false, reason: "replayed-assertion" });
    if (!federated.ok) throw new Error("No federated grant.");

    const uri = "https://app.example/resource";
    const jti = `proof-${randomUUID()}`;
    const encode = (value: string | Buffer) => Buffer.from(value).toString("base64url");
    const header = encode(JSON.stringify({ alg: "ES256", jwk: publicJwk, typ: "dpop+jwt" }));
    const claims = encode(JSON.stringify({
      ath: sha256(federated.accessToken), htm: "GET", htu: uri,
      iat: Math.floor(Date.now() / 1_000), jti
    }));
    const signingInput = `${header}.${claims}`;
    const signature = sign("sha256", Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });
    const proof = `${signingInput}.${encode(signature)}`;
    const request = {
      accessToken: federated.accessToken,
      audience: WORKLOAD_AUDIENCE,
      authScheme: "DPoP" as const,
      method: "GET",
      proof,
      scope: "orders.read",
      uri
    };
    expect(await service.consumeWorkloadAccessToken(request)).toMatchObject({ ok: true, source: "workload-federation" });
    expect(await service.consumeWorkloadAccessToken(request)).toEqual({ ok: false, reason: "replayed-proof" });
  });
});
