import {
  generateKeyPairSync,
  randomUUID,
  sign,
  type JsonWebKey,
  type KeyObject
} from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("enterprise and high-assurance boundaries", () => {
  let database: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let fapi: typeof import("@/features/enterprise/server/fapi");
  let sso: typeof import("@/features/enterprise/server/sso");
  const userId = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    database = await import("@/db");
    schema = await import("@/db/schema");
    fapi = await import("@/features/enterprise/server/fapi");
    sso = await import("@/features/enterprise/server/sso");
    await database.db.insert(schema.user).values({
      id: userId,
      name: "Enterprise Owner",
      email: `${userId}@example.com`,
      emailVerified: true
    });
  });

  afterAll(async () => {
    if (database && schema) {
      await database.db.delete(schema.user).where(eq(schema.user.id, userId));
      await database.db.delete(schema.highAssuranceClient);
      await database.sqlClient.end();
    }
  });

  function assertion(
    privateKey: KeyObject,
    clientId: string,
    audience: string,
    jti = randomUUID()
  ) {
    const now = Math.floor(Date.now() / 1_000);
    const header = Buffer.from(JSON.stringify({
      alg: "ES256",
      kid: clientId,
      typ: "JWT"
    })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({
      aud: audience,
      exp: now + 60,
      iat: now,
      iss: clientId,
      jti,
      sub: clientId
    })).toString("base64url");
    const input = `${header}.${claims}`;
    return `${input}.${sign("sha256", Buffer.from(input), {
      key: privateKey,
      dsaEncoding: "ieee-p1363"
    }).toString("base64url")}`;
  }

  it("discovers tenant ownership and fails closed on issuer mismatch", async () => {
    const tenant = await sso.discoverEnterpriseTenant(
      "engineer@northstar.auth-lab.local"
    );
    expect(tenant).toMatchObject({ protocol: "oidc", slug: "northstar" });
    expect(
      await sso.discoverEnterpriseTenant("employee@legacy.auth-lab.local")
    ).toMatchObject({ protocol: "saml", slug: "legacy-industries" });
    expect(
      await sso.evaluateEnterpriseSso({
        scenario: "wrong-issuer",
        tenantSlug: "northstar",
        userId
      })
    ).toMatchObject({ ok: false, reason: expect.stringContaining("different") });
    expect(
      await sso.evaluateEnterpriseSso({
        scenario: "valid",
        tenantSlug: "northstar",
        userId
      })
    ).toMatchObject({
      ok: true,
      membership: { role: "member", tenant: "Northstar Engineering" }
    });
  });

  it("authenticates private-key JWT once and constrains tokens to certificate lifecycle", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256"
    });
    const registered = await fapi.registerHighAssuranceClient(
      publicKey.export({ format: "jwk" }) as JsonWebKey as
        import("@/features/enterprise/server/fapi").EnterprisePublicJwk
    );
    const audience = "http://localhost:3000/api/lab/enterprise/fapi/token";
    const jwt = assertion(privateKey, registered.clientId, audience);
    const input = {
      assertion: jwt,
      audience,
      certificateThumbprint: registered.certificateThumbprint,
      clientId: registered.clientId
    };
    const token = await fapi.authenticatePrivateKeyClient(input);
    expect(token.ok).toBe(true);
    if (!token.ok) throw new Error("Token was not issued.");
    expect(
      await fapi.authenticatePrivateKeyClient(input)
    ).toMatchObject({ ok: false, reason: "invalid-or-replayed-assertion" });
    expect(
      await fapi.consumeCertificateBoundToken({
        accessToken: token.accessToken,
        certificateThumbprint: "wrong-thumbprint"
      })
    ).toBeNull();
    expect(
      await fapi.consumeCertificateBoundToken({
        accessToken: token.accessToken,
        certificateThumbprint: registered.certificateThumbprint
      })
    ).toMatchObject({ scope: "regulated.read" });

    const rotated = await fapi.rotateCertificate(registered.clientId);
    expect(rotated?.previousCertificateThumbprint).toBe(
      registered.certificateThumbprint
    );
    expect(
      await fapi.consumeCertificateBoundToken({
        accessToken: token.accessToken,
        certificateThumbprint: registered.certificateThumbprint
      })
    ).toMatchObject({ scope: "regulated.read" });
    await fapi.revokeCertificate(registered.clientId);
    expect(
      await fapi.consumeCertificateBoundToken({
        accessToken: token.accessToken,
        certificateThumbprint: registered.certificateThumbprint
      })
    ).toBeNull();
  });
});
