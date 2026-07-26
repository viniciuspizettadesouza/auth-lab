import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("local OIDC authorization-code boundary", () => {
  let database: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let provider: typeof import("@/features/federation/server/provider");
  let protocol: typeof import("@/features/federation/server/protocol");
  let config: ReturnType<
    typeof import("@/features/federation/server/config").federationConfig
  >;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    database = await import("@/db");
    schema = await import("@/db/schema");
    provider = await import("@/features/federation/server/provider");
    protocol = await import("@/features/federation/server/protocol");
    config = (await import("@/features/federation/server/config")).federationConfig();
  });

  afterAll(async () => {
    if (database) {
      await database.db.delete(schema.oidcAuthorizationCode);
      await database.sqlClient.end();
    }
  });

  async function issue(verifier: string) {
    return provider.issueAuthorizationCode({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      codeChallenge: protocol.sha256(verifier),
      subject: "integration-subject",
      email: "oidc-integration@example.com",
      name: "OIDC Integration",
      nonce: config.createNonce(),
      scope: "openid profile email"
    });
  }

  it("exchanges a code only once with the matching PKCE verifier", async () => {
    const verifier = "integration-verifier-with-sufficient-entropy";
    const code = await issue(verifier);
    const tokens = await provider.exchangeAuthorizationCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      codeVerifier: verifier,
      redirectUri: config.redirectUri
    });
    expect(tokens.idToken.split(".")).toHaveLength(3);
    await expect(
      provider.exchangeAuthorizationCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code,
        codeVerifier: verifier,
        redirectUri: config.redirectUri
      })
    ).rejects.toThrow("invalid_grant");
  });

  it("burns a code after a wrong verifier and rejects expired codes", async () => {
    const code = await issue("correct-verifier");
    await expect(
      provider.exchangeAuthorizationCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code,
        codeVerifier: "wrong-verifier",
        redirectUri: config.redirectUri
      })
    ).rejects.toThrow("invalid_grant");

    const expired = await issue("expired-verifier");
    await database.db
      .update(schema.oidcAuthorizationCode)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(schema.oidcAuthorizationCode.id, protocol.sha256(expired)));
    await expect(
      provider.exchangeAuthorizationCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code: expired,
        codeVerifier: "expired-verifier",
        redirectUri: config.redirectUri
      })
    ).rejects.toThrow("invalid_grant");
  });
});
