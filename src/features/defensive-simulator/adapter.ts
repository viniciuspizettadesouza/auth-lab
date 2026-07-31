import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "Defensive scenarios", note: "Fixed synthetic inputs" },
  { id: "flow", title: "Consequence trace", note: "No attack execution" },
  { id: "network-inspector", title: "Network inspector", note: "Scenario ID only" },
  { id: "explanation", title: "Safety boundary", note: "Controls and limitations" },
  { id: "comparison", title: "Defense comparison", note: "Observable properties" }
] as const;

export const defensiveSimulatorAdapter = {
  metadata: {
    slug: "defensive-simulator",
    name: "Defensive attack simulator",
    shortName: "Defense simulator",
    category: "Special environments",
    track: "Special environments",
    classification: "recommended",
    status: "interactive",
    summary: "A local-only consequence simulator compares authentication failures and defenses using fixed synthetic scenarios without generating attack traffic.",
    protocol: "Bounded local security simulation",
    evolution: {
      then: "Authentication examples often showed only a successful happy path.",
      now: "Safe fixed scenarios can make failure consequences, containment, recovery, replay, and protocol binding visible without handling real secrets or targets.",
      next: "Use threat modeling, defensive testing, telemetry, and authorized security review against the actual system and its operational environment."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("nist-sp-800-63b-4", { section: "§3 Authenticator Requirements", supports: ["assessment-context", "phishing-resistance", "replay-resistance", "recovery"] }),
      citeEvidence("rfc-9700", { supports: ["threat-model", "federation-security", "token-security"] }),
      citeEvidence("w3c-webauthn-3", { supports: ["phishing-resistance", "protocol-definition"] }),
      citeEvidence("rfc-9449", { supports: ["replay-resistance", "token-security"] })
    ],
    tier: {
      track: "Special environments",
      grade: "B",
      rationale: "Useful for defensive learning and review, but a bounded teaching simulator cannot establish the security of a production system."
    },
    ratings: {
      setup: "high",
      phishingResistance: "not-applicable",
      replayResistance: "not-applicable",
      recovery: "not-applicable"
    }
  },
  route: "/methods/defensive-simulator",
  panels,
  recorder: {
    journeys: ["defensive-scenarios"] as const,
    operations: {
      "simulator-run": {
        endpoint: "/api/lab/defensive-simulator",
        method: "POST",
        success: "A fixed synthetic scenario returned consequences, controls, and limitations with executed set to false.",
        failure: "The request was unowned, malformed, or outside the fixed scenario enum.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;
