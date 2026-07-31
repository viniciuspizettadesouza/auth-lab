import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { sessionAssurance } from "@/db/schema";

export const ASSURANCE_TTL_SECONDS = 5 * 60;

export type RiskScenario =
  | "routine-profile-view"
  | "new-device-export"
  | "change-recovery";

const policies = {
  "routine-profile-view": {
    risk: "low",
    requiresStepUp: false,
    reason: "A routine read can use the existing authenticated session."
  },
  "new-device-export": {
    risk: "high",
    requiresStepUp: true,
    reason:
      "A sensitive export from a new-device context requires recent phishing-resistant proof."
  },
  "change-recovery": {
    risk: "high",
    requiresStepUp: true,
    reason:
      "Changing recovery controls can weaken the account and requires recent phishing-resistant proof."
  }
} as const;

export async function evaluateRisk(
  sessionId: string,
  userId: string,
  scenario: RiskScenario
) {
  const policy = policies[scenario];
  if (!policy.requiresStepUp) {
    return { ...policy, allowed: true, assurance: "session" as const };
  }

  const [assurance] = await db
    .select({ verifiedAt: sessionAssurance.verifiedAt })
    .from(sessionAssurance)
    .where(
      and(
        eq(sessionAssurance.sessionId, sessionId),
        eq(sessionAssurance.userId, userId),
        eq(sessionAssurance.level, "phishing-resistant"),
        gt(
          sessionAssurance.verifiedAt,
          new Date(Date.now() - ASSURANCE_TTL_SECONDS * 1_000)
        )
      )
    )
    .limit(1);

  return {
    ...policy,
    allowed: Boolean(assurance),
    assurance: assurance ? ("phishing-resistant" as const) : ("required" as const),
    verifiedAt: assurance?.verifiedAt.toISOString() ?? null
  };
}

export async function recordPhishingResistantAssurance(
  sessionId: string,
  userId: string
) {
  await db
    .insert(sessionAssurance)
    .values({
      sessionId,
      userId,
      level: "phishing-resistant",
      verifiedAt: new Date()
    })
    .onConflictDoUpdate({
      target: sessionAssurance.sessionId,
      set: {
        userId,
        level: "phishing-resistant",
        verifiedAt: new Date()
      }
    });
}
