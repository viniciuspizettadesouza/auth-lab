import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  deviceAccessGrant,
  oauthDeviceAuthorization
} from "@/db/schema";
import {
  DEVICE_ACCESS_TOKEN_TTL_SECONDS,
  DEVICE_CLIENT_ID,
  DEVICE_CODE_TTL_SECONDS,
  DEVICE_POLL_INTERVAL_SECONDS,
  DEVICE_SCOPE,
  deviceFlowConfig
} from "@/features/device-flow/server/config";
import {
  createUserCode,
  digestDeviceValue,
  normalizeUserCode,
  randomDeviceCode
} from "@/features/device-flow/server/protocol";

export type DeviceTokenError =
  | "access_denied"
  | "authorization_pending"
  | "expired_token"
  | "invalid_grant"
  | "slow_down";

export async function createDeviceAuthorization(input: {
  clientId: string;
  scope: string;
}) {
  if (input.clientId !== DEVICE_CLIENT_ID || input.scope !== DEVICE_SCOPE) {
    return { ok: false as const, error: "invalid_request" as const };
  }

  const deviceCode = randomDeviceCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_SECONDS * 1_000);
  let userCode = createUserCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const [existing] = await db
      .select({ id: oauthDeviceAuthorization.id })
      .from(oauthDeviceAuthorization)
      .where(eq(oauthDeviceAuthorization.userCode, userCode))
      .limit(1);
    if (!existing) break;
    userCode = createUserCode();
  }

  await db.insert(oauthDeviceAuthorization).values({
    id: digestDeviceValue(deviceCode),
    clientId: input.clientId,
    userCode,
    scope: input.scope,
    intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
    expiresAt
  });

  const verificationUri = deviceFlowConfig().verificationUri;
  return {
    ok: true as const,
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete: `${verificationUri}?user_code=${encodeURIComponent(userCode)}`,
    expiresAt,
    intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS
  };
}

export async function authorizeUserCode(input: {
  decision: "approve" | "deny";
  userCode: string;
  userId: string;
}) {
  const userCode = normalizeUserCode(input.userCode);
  if (!userCode) return { ok: false as const, reason: "invalid-code" as const };
  const now = new Date();
  const [authorization] = await db
    .update(oauthDeviceAuthorization)
    .set({
      status: input.decision === "approve" ? "approved" : "denied",
      userId: input.userId,
      approvedAt: input.decision === "approve" ? now : null
    })
    .where(
      and(
        eq(oauthDeviceAuthorization.userCode, userCode),
        eq(oauthDeviceAuthorization.status, "pending"),
        gt(oauthDeviceAuthorization.expiresAt, now)
      )
    )
    .returning({
      clientId: oauthDeviceAuthorization.clientId,
      scope: oauthDeviceAuthorization.scope,
      status: oauthDeviceAuthorization.status
    });
  return authorization
    ? { ok: true as const, ...authorization }
    : { ok: false as const, reason: "invalid-or-consumed" as const };
}

export async function inspectUserCode(value: string) {
  const userCode = normalizeUserCode(value);
  if (!userCode) return null;
  const [authorization] = await db
    .select({
      clientId: oauthDeviceAuthorization.clientId,
      expiresAt: oauthDeviceAuthorization.expiresAt,
      scope: oauthDeviceAuthorization.scope,
      status: oauthDeviceAuthorization.status,
      userCode: oauthDeviceAuthorization.userCode
    })
    .from(oauthDeviceAuthorization)
    .where(
      and(
        eq(oauthDeviceAuthorization.userCode, userCode),
        gt(oauthDeviceAuthorization.expiresAt, new Date())
      )
    )
    .limit(1);
  return authorization ?? null;
}

export async function exchangeDeviceCode(input: {
  clientId: string;
  deviceCode: string;
}) {
  if (input.clientId !== DEVICE_CLIENT_ID || !input.deviceCode) {
    return { ok: false as const, error: "invalid_grant" as DeviceTokenError };
  }
  const id = digestDeviceValue(input.deviceCode);
  const [authorization] = await db
    .select()
    .from(oauthDeviceAuthorization)
    .where(
      and(
        eq(oauthDeviceAuthorization.id, id),
        eq(oauthDeviceAuthorization.clientId, input.clientId)
      )
    )
    .limit(1);
  if (!authorization || authorization.status === "consumed") {
    return { ok: false as const, error: "invalid_grant" as DeviceTokenError };
  }

  const now = new Date();
  if (authorization.expiresAt <= now) {
    return { ok: false as const, error: "expired_token" as DeviceTokenError };
  }
  if (authorization.status === "denied") {
    return { ok: false as const, error: "access_denied" as DeviceTokenError };
  }

  if (authorization.status === "pending") {
    const tooSoon =
      authorization.lastPolledAt &&
      now.getTime() - authorization.lastPolledAt.getTime() <
        authorization.intervalSeconds * 1_000;
    await db
      .update(oauthDeviceAuthorization)
      .set({
        intervalSeconds: tooSoon
          ? authorization.intervalSeconds + 5
          : authorization.intervalSeconds,
        lastPolledAt: now,
        pollCount: sql`${oauthDeviceAuthorization.pollCount} + 1`
      })
      .where(eq(oauthDeviceAuthorization.id, id));
    return {
      ok: false as const,
      error: (tooSoon ? "slow_down" : "authorization_pending") as DeviceTokenError,
      intervalSeconds: tooSoon
        ? authorization.intervalSeconds + 5
        : authorization.intervalSeconds
    };
  }

  const accessToken = randomDeviceCode();
  const expiresAt = new Date(
    Date.now() + DEVICE_ACCESS_TOKEN_TTL_SECONDS * 1_000
  );
  const exchanged = await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(oauthDeviceAuthorization)
      .set({ status: "consumed", consumedAt: now })
      .where(
        and(
          eq(oauthDeviceAuthorization.id, id),
          eq(oauthDeviceAuthorization.status, "approved"),
          gt(oauthDeviceAuthorization.expiresAt, now)
        )
      )
      .returning();
    if (!consumed?.userId) return null;
    await tx.insert(deviceAccessGrant).values({
      id: randomUUID(),
      authorizationId: consumed.id,
      userId: consumed.userId,
      tokenDigest: digestDeviceValue(accessToken),
      scope: consumed.scope,
      expiresAt
    });
    return consumed;
  });
  if (!exchanged) {
    return { ok: false as const, error: "invalid_grant" as DeviceTokenError };
  }
  return {
    ok: true as const,
    accessToken,
    expiresAt,
    scope: exchanged.scope
  };
}

export async function consumeDeviceAccessToken(accessToken: string) {
  const [grant] = await db
    .select({
      scope: deviceAccessGrant.scope,
      userId: deviceAccessGrant.userId
    })
    .from(deviceAccessGrant)
    .where(
      and(
        eq(deviceAccessGrant.tokenDigest, digestDeviceValue(accessToken)),
        eq(deviceAccessGrant.scope, DEVICE_SCOPE),
        gt(deviceAccessGrant.expiresAt, new Date()),
        isNull(deviceAccessGrant.revokedAt)
      )
    )
    .limit(1);
  return grant ?? null;
}
