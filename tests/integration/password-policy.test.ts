import { beforeAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("password policy integration", () => {
  let auth: typeof import("@/lib/auth").auth;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    auth = (await import("@/lib/auth")).auth;
  });

  it("rejects a blocklisted prospective password at the auth boundary", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          name: "Policy Test",
          email: `policy-${Date.now()}@example.com`,
          password: "passwordpassword"
        }
      })
    ).rejects.toMatchObject({
      body: {
        code: "PASSWORD_BLOCKLISTED"
      }
    });
  });
});
