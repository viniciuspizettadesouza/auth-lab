import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "Operator experience", note: "Secret shown once" },
  { id: "flow", title: "Flow", note: "Machine principal only" },
  { id: "network-inspector", title: "Network inspector", note: "No raw keys recorded" },
  { id: "explanation", title: "Explanation", note: "Rotation and revocation" },
  { id: "comparison", title: "Comparison", note: "Baseline to improve" }
] as const;

export const apiKeyAdapter = {
  metadata: {
    slug: "api-key",
    name: "API key lifecycle",
    shortName: "API key",
    category: "Machine authentication",
    track: "Machine & workload identity",
    classification: "transitional",
    status: "interactive",
    summary:
      "A visitor-owned service principal demonstrates one-time key display, digest-only storage, scope, audience, rotation, audit, and revocation.",
    protocol: "Application-specific bearer key",
    evolution: {
      then: "A single copied string made unattended API access easy to integrate.",
      now: "Long-lived bearer keys need explicit machine ownership, least privilege, expiry, rotation, audit, and rapid revocation.",
      next: "Exchange managed credentials for short-lived tokens or use workload federation so deployments do not carry static secrets."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("nist-sp-800-204a", {
        supports: ["assessment-context", "threat-model", "workload-identity"]
      }),
      citeEvidence("rfc-9700", {
        section: "§2.5 Client Authentication",
        supports: ["threat-model", "token-security", "workload-identity"]
      })
    ],
    tier: {
      track: "Machine & workload identity",
      grade: "C",
      rationale:
        "Broadly compatible and governable, but a copied bearer secret remains replayable until expiry or revocation."
    },
    ratings: {
      setup: "high",
      phishingResistance: "not-applicable",
      replayResistance: "low",
      recovery: "high"
    }
  },
  route: "/methods/workloads",
  panels,
  recorder: {
    journeys: ["api-key-lifecycle"] as const,
    operations: {
      "workload-create": {
        endpoint: "/api/lab/workloads",
        method: "POST",
        success: "A separate machine principal and digest-stored API key were created; the secret was displayed once.",
        failure: "The machine principal request was invalid."
      },
      "workload-resource": {
        endpoint: "/api/lab/workloads/resource",
        method: "GET",
        success: "The exact audience and required scope were authorized for the active machine key.",
        failure: "The resource rejected an invalid, expired, revoked, wrongly scoped, or wrong-audience key."
      },
      "workload-rotate": {
        endpoint: "/api/lab/workloads/key",
        method: "POST",
        success: "A replacement key was displayed once and the previous key entered a short overlap window.",
        failure: "Rotation required a live key owned by this lab visitor."
      },
      "workload-revoke": {
        endpoint: "/api/lab/workloads/key",
        method: "DELETE",
        success: "The selected key was revoked immediately.",
        failure: "Revocation required a live key owned by this lab visitor."
      },
      "workload-replay": {
        endpoint: "/api/lab/workloads/resource",
        method: "GET",
        success: "Unexpectedly accepted a revoked API key.",
        failure: "The resource rejected the revoked bearer key.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const personalAccessTokenAdapter = {
  metadata: {
    ...apiKeyAdapter.metadata,
    slug: "personal-access-token",
    name: "Personal access token",
    shortName: "PAT",
    status: "simulation",
    summary: "A user-created bearer token is modeled as a legacy bridge for automation, with the same theft and lifecycle risks as API keys.",
    protocol: "Provider-specific bearer token",
    evolution: {
      then: "Personal tokens let scripts replace a person's password without introducing a machine principal.",
      now: "Fine-grained, expiring PATs are safer than passwords but still couple automation to a human owner and remain replayable bearer secrets.",
      next: "Use a dedicated service principal with short-lived workload credentials whenever the automation has an independent lifecycle."
    }
  },
  route: "/methods/workloads",
  panels,
  recorder: { journeys: ["api-key-lifecycle"] as const, operations: {} }
} as const satisfies MethodAdapter;

export const clientCredentialsAdapter = {
  metadata: {
    slug: "client-credentials",
    name: "OAuth Client Credentials",
    shortName: "Client credentials",
    category: "Machine authentication",
    track: "Machine & workload identity",
    classification: "recommended",
    status: "interactive",
    summary: "A confidential service client exchanges its managed credential for a scoped, audience-bound, five-minute access token.",
    protocol: "OAuth 2.0 Client Credentials",
    evolution: {
      then: "Static API keys directly authorized every resource request.",
      now: "Client Credentials separates client authentication from short-lived, scoped access tokens and resource enforcement.",
      next: "Replace copied client secrets with asymmetric client authentication or platform-issued workload assertions."
    },
    evidenceDate: "2026-07-31",
    evidence: [citeEvidence("rfc-6749", { section: "§4.4 Client Credentials Grant", supports: ["protocol-definition", "workload-identity"] }), citeEvidence("rfc-9700", { section: "§2.5 Client Authentication", supports: ["threat-model", "token-security"] })],
    tier: { track: "Machine & workload identity", grade: "A", rationale: "Short-lived scoped tokens improve containment when the confidential client credential is protected and rotated." },
    ratings: { setup: "medium", phishingResistance: "not-applicable", replayResistance: "medium", recovery: "high" }
  },
  route: "/methods/workloads",
  panels,
  recorder: {
    journeys: ["client-credentials-lifecycle"] as const,
    operations: {
      "client-register": { endpoint: "/api/lab/workloads/oauth/client", method: "POST", success: "A one-time client secret was issued to the machine principal.", failure: "Client registration required an owned principal." },
      "client-token": { endpoint: "/api/lab/workloads/oauth/token", method: "POST", success: "The confidential client exchanged its secret for a five-minute scoped token.", failure: "Client authentication, audience, or scope validation failed." },
      "client-resource": { endpoint: "/api/lab/workloads/access/resource", method: "GET", success: "The resource accepted the short-lived token for its audience and scope.", failure: "The resource rejected the token.", completesFlow: true },
      "client-rotate": { endpoint: "/api/lab/workloads/oauth/client", method: "POST", success: "The client secret rotated with a bounded overlap.", failure: "Rotation required the current owned credential." },
      "grant-revoke": { endpoint: "/api/lab/workloads/grants", method: "DELETE", success: "Active machine access grants were revoked.", failure: "Revocation required the owned principal.", completesFlow: true }
    }
  }
} as const satisfies MethodAdapter;

export const workloadFederationAdapter = {
  metadata: {
    slug: "workload-federation",
    name: "Workload identity federation",
    shortName: "Workload federation",
    category: "Machine authentication",
    track: "Machine & workload identity",
    classification: "recommended",
    status: "interactive",
    summary: "A synthetic platform attests a workload, which exchanges a 60-second signed assertion for a two-minute sender-constrained token.",
    protocol: "OAuth Token Exchange + DPoP",
    evolution: {
      then: "Deployments carried long-lived API keys or client secrets in configuration.",
      now: "A trusted platform can attest runtime identity and exchange a short-lived assertion for narrowly targeted access without a stored application secret.",
      next: "Use the deployment platform's managed identity, trust policy, metadata boundary, automated rotation, and production-grade issuer validation."
    },
    evidenceDate: "2026-07-31",
    evidence: [citeEvidence("rfc-8693", { section: "§2 Token Exchange", supports: ["protocol-definition", "workload-identity", "token-security"] }), citeEvidence("rfc-9449", { supports: ["replay-resistance", "token-security"] }), citeEvidence("spiffe-svid", { supports: ["assessment-context", "workload-identity"] })],
    tier: { track: "Machine & workload identity", grade: "S", rationale: "Short-lived platform-attested identity removes stored application secrets where trustworthy runtime federation exists." },
    ratings: { setup: "low", phishingResistance: "not-applicable", replayResistance: "high", recovery: "high" }
  },
  route: "/methods/workloads",
  panels,
  recorder: {
    journeys: ["workload-federation"] as const,
    operations: {
      "federation-attest": { endpoint: "/api/lab/workloads/federation/attestation", method: "POST", success: "The synthetic platform signed a 60-second workload assertion.", failure: "Attestation required an owned active workload." },
      "federation-exchange": { endpoint: "/api/lab/workloads/federation/token", method: "POST", success: "The assertion was consumed once for a two-minute DPoP-bound token.", failure: "Signature, issuer, audience, time, scope, or assertion replay validation failed." },
      "federation-resource": { endpoint: "/api/lab/workloads/access/resource", method: "GET", success: "The resource validated the token and its exact DPoP proof.", failure: "The token or proof binding failed.", completesFlow: true },
      "federation-replay": { endpoint: "/api/lab/workloads/federation/token", method: "POST", success: "Unexpectedly accepted a consumed platform assertion.", failure: "The assertion replay cache rejected the reused identifier.", completesFlow: true },
      "proof-replay": { endpoint: "/api/lab/workloads/access/resource", method: "GET", success: "Unexpectedly accepted a reused proof.", failure: "The DPoP replay cache rejected the reused proof identifier.", completesFlow: true }
    }
  }
} as const satisfies MethodAdapter;

export const workloadAdapters = [apiKeyAdapter, personalAccessTokenAdapter, clientCredentialsAdapter, workloadFederationAdapter] as const;
