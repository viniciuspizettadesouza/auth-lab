import {
  generateKeyPairSync,
  randomUUID,
  sign,
  type JsonWebKey
} from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("session assurance and DPoP persistence", () => {
  let database: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let dpop: typeof import("@/features/session-token/server/dpop");
  let risk: typeof import("@/features/session-token/server/risk");
  const userId = randomUUID();
  const sessionId = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    database = await import("@/db");
    schema = await import("@/db/schema");
    dpop = await import("@/features/session-token/server/dpop");
    risk = await import("@/features/session-token/server/risk");
    await database.db.insert(schema.user).values({
      id: userId,
      name: "Session Owner",
      email: `${userId}@example.com`,
      emailVerified: true
    });
    await database.db.insert(schema.session).values({
      id: sessionId,
      expiresAt: new Date(Date.now() + 60_000),
      token: randomUUID(),
      userId
    });
  });

  afterAll(async () => {
    if (database && schema) {
      await database.db.delete(schema.user).where(eq(schema.user.id, userId));
      await database.sqlClient.end();
    }
  });

  it("requires recent assurance only for risky operations", async () => {
    expect(
      (await risk.evaluateRisk(sessionId, userId, "routine-profile-view")).allowed
    ).toBe(true);
    expect(
      (await risk.evaluateRisk(sessionId, userId, "new-device-export")).allowed
    ).toBe(false);
    await risk.recordPhishingResistantAssurance(sessionId, userId);
    expect(
      (await risk.evaluateRisk(sessionId, userId, "new-device-export")).allowed
    ).toBe(true);
    await database.db
      .update(schema.sessionAssurance)
      .set({ verifiedAt: new Date(Date.now() - 301_000) })
      .where(eq(schema.sessionAssurance.sessionId, sessionId));
    expect(
      (await risk.evaluateRisk(sessionId, userId, "change-recovery")).allowed
    ).toBe(false);
  });

  it("accepts a bound proof once and rejects its replay", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256"
    });
    const publicJwk = publicKey.export({
      format: "jwk"
    }) as JsonWebKey as import("@/features/session-token/server/dpop").DpopPublicJwk;
    const grant = await dpop.issueDpopGrant({ publicJwk, sessionId, userId });
    const uri = "http://localhost:3000/api/lab/dpop/resource";
    const header = Buffer.from(JSON.stringify({
      alg: "ES256",
      jwk: publicJwk,
      typ: "dpop+jwt"
    })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({
      ath: dpop.sha256(grant.accessToken),
      htm: "GET",
      htu: uri,
      iat: Math.floor(Date.now() / 1_000),
      jti: `integration-${randomUUID()}`
    })).toString("base64url");
    const input = `${header}.${claims}`;
    const proof = `${input}.${sign("sha256", Buffer.from(input), {
      key: privateKey,
      dsaEncoding: "ieee-p1363"
    }).toString("base64url")}`;
    const request = {
      accessToken: grant.accessToken,
      method: "GET",
      proof,
      uri
    };
    expect((await dpop.consumeDpopGrant(request)).ok).toBe(true);
    expect(await dpop.consumeDpopGrant(request)).toEqual({
      ok: false,
      reason: "replayed-proof"
    });
  });
});
