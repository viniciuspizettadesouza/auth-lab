import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "User experience", note: "Real two-device handoff" },
  { id: "flow", title: "Flow", note: "User code and polling" },
  { id: "network-inspector", title: "Network inspector", note: "Secrets excluded" },
  { id: "explanation", title: "Explanation", note: "Phishing boundary included" },
  { id: "comparison", title: "Comparison", note: "Constrained environments" }
] as const;

export const deviceFlowAdapter = {
  metadata: {
    slug: "device-flow",
    name: "Device Authorization Grant",
    shortName: "Device flow",
    category: "Special environments",
    track: "Special environments",
    classification: "recommended",
    status: "interactive",
    summary:
      "An input-constrained client delegates user authentication and consent to a separate browser.",
    protocol: "OAuth 2.0 Device Authorization Grant",
    evolution: {
      then: "TVs and command-line devices could not safely host ordinary browser redirect flows.",
      now: "A short user code links a constrained client to an authenticated browser while the client polls at a controlled interval.",
      next: "Use it only where a normal redirect is impractical, show device context during approval, and defend users from code phishing."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("rfc-8628", {
        supports: [
          "assessment-context",
          "phishing-resistance",
          "protocol-definition",
          "replay-resistance"
        ]
      }),
      citeEvidence("rfc-9700", {
        supports: ["threat-model", "token-security"]
      })
    ],
    tier: {
      track: "Special environments",
      grade: "A",
      rationale:
        "The standards-based choice for input-constrained clients when user-code phishing and polling are handled."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "medium",
      replayResistance: "high",
      recovery: "depends"
    }
  },
  route: "/methods/device",
  panels,
  recorder: {
    journeys: ["device-authorization"] as const,
    operations: {
      "device-request": {
        endpoint: "/api/lab/device/authorize",
        method: "POST",
        success: "The authorization server issued separate short-lived device and user codes with a minimum polling interval.",
        failure: "The device request was rejected for an unknown client or invalid scope."
      },
      "device-poll": {
        endpoint: "/api/lab/device/token",
        method: "POST",
        success: "The approved device code was atomically consumed and exchanged for a short-lived scoped access token.",
        failure: "The token endpoint returned pending, slow-down, denial, expiry, or replay without exposing credentials."
      },
      "device-approve": {
        endpoint: "/api/lab/device/verify",
        method: "POST",
        success: "The authenticated user approved the displayed client and scopes for this user code.",
        failure: "Approval required an authenticated user and a live, unconsumed user code."
      },
      "device-deny": {
        endpoint: "/api/lab/device/verify",
        method: "POST",
        success: "The authenticated user denied the request; polling can no longer produce a token.",
        failure: "Denial required a live pending user code."
      },
      "device-resource": {
        endpoint: "/api/lab/device/resource",
        method: "GET",
        success: "The API accepted the short-lived token for its exact device.read scope.",
        failure: "The resource rejected a missing, expired, revoked, or insufficiently scoped token.",
        completesFlow: true
      },
      "device-replay": {
        endpoint: "/api/lab/device/token",
        method: "POST",
        success: "Unexpectedly issued another token for an already-consumed device code.",
        failure: "The single-use device code was rejected after its successful exchange.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;
