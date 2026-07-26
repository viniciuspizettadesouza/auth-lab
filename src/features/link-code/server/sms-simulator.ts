import "server-only";

import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { verification } from "@/db/schema/auth";
import { appendOwnedEvent, getOwnedFlow } from "@/services/recorder/service";
import {
  SMS_SIMULATION_ALLOWED_ATTEMPTS,
  SMS_SIMULATION_EXPIRES_IN_SECONDS
} from "@/features/link-code/config";

const lifetimeMs = SMS_SIMULATION_EXPIRES_IN_SECONDS * 1000;
const maxAttempts = SMS_SIMULATION_ALLOWED_ATTEMPTS;

type StoredChallenge = {
  digest: string;
  attempts: number;
  consumed: boolean;
};

function identifier(visitorId: string, flowId: string) {
  return `sms-sim:${visitorId}:${flowId}`;
}

function digest(code: string) {
  return createHmac(
    "sha256",
    process.env.BETTER_AUTH_SECRET ??
      "development-only-auth-lab-secret-change-me"
  )
    .update(code)
    .digest("hex");
}

function equalDigest(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function issueSimulatedSms(
  visitorId: string,
  flowId: string,
  scenario: "delivered" | "intercepted" | "recycled-number"
) {
  const flow = await getOwnedFlow(flowId, visitorId);
  if (!flow || flow.method !== "sms-otp") return null;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const challenge: StoredChallenge = {
    digest: digest(code),
    attempts: 0,
    consumed: false
  };
  const key = identifier(visitorId, flowId);
  await db.delete(verification).where(eq(verification.identifier, key));
  await db.insert(verification).values({
    id: randomUUID(),
    identifier: key,
    value: JSON.stringify(challenge),
    expiresAt: new Date(Date.now() + lifetimeMs)
  });

  await appendOwnedEvent(flowId, visitorId, {
    actor: "application",
    action: `sms-simulation.${scenario}`,
    description:
      scenario === "delivered"
        ? "The synthetic carrier delivered the code to the intended device."
        : scenario === "intercepted"
          ? "The simulation exposed how a carrier-path attacker could receive the code."
          : "The simulation delivered the code to a recycled-number holder.",
    outcome: scenario === "delivered" ? "success" : "failure",
    metadata: {
      endpoint: "/api/lab/sms",
      method: "POST",
      statusCode: 201
    }
  });

  return {
    code,
    expiresAt: new Date(Date.now() + lifetimeMs).toISOString(),
    recipient:
      scenario === "delivered"
        ? "intended synthetic device"
        : scenario === "intercepted"
          ? "simulated interceptor"
          : "simulated new number owner"
  };
}

export async function verifySimulatedSms(
  visitorId: string,
  flowId: string,
  code: string
) {
  const flow = await getOwnedFlow(flowId, visitorId);
  if (!flow || flow.method !== "sms-otp") return "not-found" as const;

  const key = identifier(visitorId, flowId);
  const [record] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, key))
    .limit(1);
  if (!record) return "not-found" as const;
  if (record.expiresAt <= new Date()) return "expired" as const;

  const stored = JSON.parse(record.value) as StoredChallenge;
  if (stored.consumed) return "replayed" as const;
  if (stored.attempts >= maxAttempts) return "locked" as const;

  if (!equalDigest(stored.digest, digest(code))) {
    await db
      .update(verification)
      .set({
        value: JSON.stringify({
          ...stored,
          attempts: stored.attempts + 1
        } satisfies StoredChallenge),
        updatedAt: new Date()
      })
      .where(eq(verification.id, record.id));
    return "invalid" as const;
  }

  await db
    .update(verification)
    .set({
      value: JSON.stringify({
        ...stored,
        consumed: true
      } satisfies StoredChallenge),
      updatedAt: new Date()
    })
    .where(eq(verification.id, record.id));
  return "verified" as const;
}
