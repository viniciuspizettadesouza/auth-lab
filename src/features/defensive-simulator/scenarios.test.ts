import { describe, expect, it } from "vitest";

import {
  defensiveScenarioCatalog,
  defensiveScenarioIds,
  evaluateDefensiveScenario
} from "@/features/defensive-simulator/server/scenarios";

describe("defensive simulator scenarios", () => {
  it("keeps every scenario synthetic, non-executing, and educational", () => {
    expect(defensiveScenarioCatalog).toHaveLength(defensiveScenarioIds.length);
    for (const id of defensiveScenarioIds) {
      const result = evaluateDefensiveScenario(id);
      expect(result).toMatchObject({ id, synthetic: true, executed: false });
      expect(result.steps.length).toBeGreaterThanOrEqual(2);
      expect(result.controls.length).toBeGreaterThanOrEqual(3);
      expect(result.consequence.length).toBeGreaterThan(30);
      expect(result.limitation.length).toBeGreaterThan(20);
    }
  });

  it("covers every roadmap threat family", () => {
    expect(defensiveScenarioIds).toEqual(expect.arrayContaining([
      "reused-password",
      "credential-stuffing",
      "captured-magic-link",
      "captured-otp",
      "push-fatigue",
      "recovery-abuse",
      "session-fixation",
      "token-expiry-replay-revocation",
      "missing-oauth-state",
      "invalid-redirect-uri",
      "email-only-account-linking",
      "phishing-vs-webauthn",
      "bearer-vs-sender-constrained"
    ]));
  });

  it("contrasts bearer authority with sender proof without exposing artifacts", () => {
    const result = evaluateDefensiveScenario("bearer-vs-sender-constrained");
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ actor: "bearer resource model", outcome: "exposed" }),
      expect.objectContaining({ actor: "DPoP resource model", outcome: "blocked" })
    ]));
    expect(JSON.stringify(result)).not.toMatch(/authorization:|private_key|access_token|https?:\/\/localhost/i);
  });
});
