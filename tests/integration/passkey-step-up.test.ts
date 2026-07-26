import { randomUUID } from "node:crypto";

import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("security-key step-up challenge boundary", () => {
  let database: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let stepUp: typeof import("@/features/passkey/server/step-up");
  let config: typeof import("@/features/passkey/server/config");
  const userA = randomUUID();
  const userB = randomUUID();
  const emptyResponse = {} as AuthenticationResponseJSON;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    database = await import("@/db");
    schema = await import("@/db/schema");
    stepUp = await import("@/features/passkey/server/step-up");
    config = await import("@/features/passkey/server/config");
    await database.db.insert(schema.user).values([
      {
        id: userA,
        name: "Passkey Owner",
        email: `${userA}@example.com`,
        emailVerified: true
      },
      {
        id: userB,
        name: "Different Owner",
        email: `${userB}@example.com`,
        emailVerified: true
      }
    ]);
  });

  afterAll(async () => {
    if (database && schema) {
      await database.db.delete(schema.user).where(eq(schema.user.id, userA));
      await database.db.delete(schema.user).where(eq(schema.user.id, userB));
      await database.sqlClient.end();
    }
  });

  async function insertChallenge({
    consumed = false,
    expired = false
  } = {}) {
    const id = randomUUID();
    await database.db.insert(schema.webauthnChallenge).values({
      id,
      challenge: "public-test-challenge",
      userId: userA,
      purpose: "security-key-step-up",
      expiresAt: new Date(Date.now() + (expired ? -1 : 60_000)),
      consumedAt: consumed ? new Date() : null
    });
    return id;
  }

  it("rejects expiry, replay, and another session owner before proof verification", async () => {
    const origin = config.webauthnRelyingParty().origin;
    const expired = await stepUp.verifySecurityKeyStepUp({
      challengeId: await insertChallenge({ expired: true }),
      origin,
      response: emptyResponse,
      userId: userA
    });
    const replayed = await stepUp.verifySecurityKeyStepUp({
      challengeId: await insertChallenge({ consumed: true }),
      origin,
      response: emptyResponse,
      userId: userA
    });
    const foreign = await stepUp.verifySecurityKeyStepUp({
      challengeId: await insertChallenge(),
      origin,
      response: emptyResponse,
      userId: userB
    });
    expect(expired).toEqual({ ok: false, reason: "expired-or-replayed" });
    expect(replayed).toEqual({ ok: false, reason: "expired-or-replayed" });
    expect(foreign).toEqual({ ok: false, reason: "expired-or-replayed" });
  });

  it("rejects an invalid origin without consuming the valid challenge", async () => {
    const challengeId = await insertChallenge();
    const result = await stepUp.verifySecurityKeyStepUp({
      challengeId,
      origin: "https://auth-lab.invalid",
      response: emptyResponse,
      userId: userA
    });
    const [stored] = await database.db
      .select({ consumedAt: schema.webauthnChallenge.consumedAt })
      .from(schema.webauthnChallenge)
      .where(eq(schema.webauthnChallenge.id, challengeId));
    expect(result).toEqual({ ok: false, reason: "invalid-origin" });
    expect(stored.consumedAt).toBeNull();
  });
});
