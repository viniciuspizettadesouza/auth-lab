import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("OAuth Device Authorization Grant boundary", () => {
  let database: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let service: typeof import("@/features/device-flow/server/service");
  let config: typeof import("@/features/device-flow/server/config");
  const userId = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    database = await import("@/db");
    schema = await import("@/db/schema");
    service = await import("@/features/device-flow/server/service");
    config = await import("@/features/device-flow/server/config");
    await database.db.insert(schema.user).values({
      id: userId,
      name: "Device Flow Owner",
      email: `${userId}@example.com`,
      emailVerified: true
    });
  });

  afterAll(async () => {
    if (database && schema) {
      await database.db.delete(schema.user).where(eq(schema.user.id, userId));
      await database.db.delete(schema.oauthDeviceAuthorization);
      await database.sqlClient.end();
    }
  });

  async function issue() {
    const result = await service.createDeviceAuthorization({
      clientId: config.DEVICE_CLIENT_ID,
      scope: config.DEVICE_SCOPE
    });
    if (!result.ok) throw new Error("Could not issue test device code.");
    return result;
  }

  it("enforces polling interval, approval, one-time exchange, and scope", async () => {
    const authorization = await issue();
    expect(
      await service.exchangeDeviceCode({
        clientId: config.DEVICE_CLIENT_ID,
        deviceCode: authorization.deviceCode
      })
    ).toMatchObject({ ok: false, error: "authorization_pending" });
    expect(
      await service.exchangeDeviceCode({
        clientId: config.DEVICE_CLIENT_ID,
        deviceCode: authorization.deviceCode
      })
    ).toMatchObject({ ok: false, error: "slow_down" });
    expect(
      await service.authorizeUserCode({
        decision: "approve",
        userCode: authorization.userCode,
        userId
      })
    ).toMatchObject({ ok: true, status: "approved" });
    const token = await service.exchangeDeviceCode({
      clientId: config.DEVICE_CLIENT_ID,
      deviceCode: authorization.deviceCode
    });
    expect(token.ok).toBe(true);
    if (!token.ok) throw new Error("No access token.");
    expect(await service.consumeDeviceAccessToken(token.accessToken)).toMatchObject({
      scope: config.DEVICE_SCOPE,
      userId
    });
    expect(
      await service.exchangeDeviceCode({
        clientId: config.DEVICE_CLIENT_ID,
        deviceCode: authorization.deviceCode
      })
    ).toEqual({ ok: false, error: "invalid_grant" });
  });

  it("propagates denial and expiry without issuing a token", async () => {
    const denied = await issue();
    await service.authorizeUserCode({
      decision: "deny",
      userCode: denied.userCode,
      userId
    });
    expect(
      await service.exchangeDeviceCode({
        clientId: config.DEVICE_CLIENT_ID,
        deviceCode: denied.deviceCode
      })
    ).toEqual({ ok: false, error: "access_denied" });

    const expired = await issue();
    await database.db
      .update(schema.oauthDeviceAuthorization)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(
        schema.oauthDeviceAuthorization.id,
        (await import("@/features/device-flow/server/protocol"))
          .digestDeviceValue(expired.deviceCode)
      ));
    expect(
      await service.exchangeDeviceCode({
        clientId: config.DEVICE_CLIENT_ID,
        deviceCode: expired.deviceCode
      })
    ).toEqual({ ok: false, error: "expired_token" });
  });
});
