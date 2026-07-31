import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "Wallet experience", note: "Synthetic local wallet" },
  { id: "flow", title: "Flow", note: "Issuer · wallet · verifier" },
  { id: "network-inspector", title: "Network inspector", note: "Artifacts excluded" },
  { id: "explanation", title: "Explanation", note: "Privacy and trust" },
  { id: "comparison", title: "Comparison", note: "Publication status visible" }
] as const;

export const verifiablePresentationAdapter = {
  metadata: {
    slug: "verifiable-presentation",
    name: "OpenID for Verifiable Presentations",
    shortName: "OID4VP",
    category: "Federation",
    track: "Federation & delegated authorization",
    classification: "emerging",
    status: "interactive",
    summary: "A synthetic wallet selectively presents issuer-protected claims with holder proof, consent, nonce and verifier-audience binding.",
    protocol: "OpenID4VP 1.0 + local SD-JWT model",
    evolution: {
      then: "Online federation asked an identity provider for claims during each relying-party interaction.",
      now: "Final OpenID4VP 1.0 lets a verifier request presentations from a wallet, while credential formats and ecosystem trust remain separate choices.",
      next: "Evaluate wallet trust, issuer governance, format interoperability, status privacy, recovery, and correlation before production adoption."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("oidf-openid4vp-1.0", { section: "§14 Security and §15 Privacy", supports: ["protocol-definition", "federation-security", "replay-resistance"] }),
      citeEvidence("rfc-9901", { supports: ["protocol-definition", "token-security"] }),
      citeEvidence("draft-ietf-oauth-sd-jwt-vc-16", { supports: ["assessment-context", "protocol-definition"] })
    ],
    tier: { track: "Federation & delegated authorization", grade: "B", rationale: "A final presentation protocol with strong privacy potential, but trust, wallet, format, recovery, and revocation ecosystems remain contextual." },
    ratings: { setup: "low", phishingResistance: "depends", replayResistance: "high", recovery: "depends" }
  },
  route: "/methods/portable",
  panels,
  recorder: {
    journeys: ["portable-presentation"] as const,
    operations: {
      "portable-issue": { endpoint: "/api/lab/portable/credentials", method: "POST", success: "The local issuer returned a holder-bound synthetic credential and selective disclosures.", failure: "Issuance rejected an invalid holder key." },
      "portable-request": { endpoint: "/api/lab/portable/requests", method: "POST", success: "The verifier created a two-minute nonce-bound claim request.", failure: "The verifier request was invalid." },
      "portable-deny": { endpoint: "/api/lab/portable/requests", method: "DELETE", success: "The wallet denied an excessive request without disclosing claims.", failure: "The request was expired, consumed, or unowned.", completesFlow: true },
      "portable-present": { endpoint: "/api/lab/portable/presentations", method: "POST", success: "Issuer integrity, status, disclosures, holder proof, audience, nonce, time, and replay checks passed.", failure: "The presentation failed closed without creating a session.", completesFlow: true },
      "portable-replay": { endpoint: "/api/lab/portable/presentations", method: "POST", success: "Unexpectedly accepted a consumed presentation.", failure: "The consumed request and proof identifier rejected replay.", completesFlow: true },
      "portable-revoke": { endpoint: "/api/lab/portable/credentials", method: "DELETE", success: "The synthetic credential status changed to revoked.", failure: "Revocation required the visitor-owned active credential.", completesFlow: true }
    }
  }
} as const satisfies MethodAdapter;

export const agentAuthorizationAdapter = {
  metadata: {
    slug: "agent-authorization",
    name: "Agent delegated authorization",
    shortName: "Agent authorization",
    category: "Federation",
    track: "Federation & delegated authorization",
    classification: "emerging",
    status: "simulation",
    summary: "A non-executing policy exhibit separates user authority, agent identity, action context, approval, expiry, and audit.",
    protocol: "Product experiment informed by OAuth agent drafts",
    evolution: {
      then: "Applications received broad user scopes and performed actions through fixed user interfaces.",
      now: "Agents can plan many contextual actions, making explicit actor identity, constrained delegation, approval, and policy enforcement more important.",
      next: "Track working-group profiles and interoperability; do not invent a production agent token from this exhibit."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("draft-aap-oauth-profile-01", { supports: ["assessment-context", "protocol-definition", "threat-model"] }),
      citeEvidence("rfc-8693", { supports: ["protocol-definition", "token-security"] })
    ],
    tier: { track: "Federation & delegated authorization", grade: "C", rationale: "Existing authorization building blocks help, but agent-specific profiles and operational assurance remain immature." },
    ratings: { setup: "low", phishingResistance: "depends", replayResistance: "depends", recovery: "depends" }
  },
  route: "/methods/portable",
  panels,
  recorder: {
    journeys: ["agent-policy-exhibit"] as const,
    operations: {
      "agent-evaluate": { endpoint: "/api/lab/portable/agent", method: "POST", success: "The policy exhibit returned allow, deny, or approval-required without executing a tool.", failure: "The unknown scenario was rejected.", completesFlow: true }
    }
  }
} as const satisfies MethodAdapter;

export const portableAdapters = [verifiablePresentationAdapter, agentAuthorizationAdapter] as const;
