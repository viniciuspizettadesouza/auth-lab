import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "User experience", note: "Real lifecycle controls" },
  { id: "flow", title: "Flow", note: "Session and token actors" },
  { id: "network-inspector", title: "Network inspector", note: "Secrets excluded" },
  { id: "explanation", title: "Explanation", note: "Lifecycle before format" },
  { id: "comparison", title: "Comparison", note: "Declared browser/API contexts" }
] as const;

export const cookieSessionAdapter = {
  metadata: {
    slug: "cookie-session",
    name: "Sessions, tokens, and step-up",
    shortName: "Cookie session",
    category: "Sessions",
    track: "Sessions & tokens",
    classification: "recommended",
    status: "interactive",
    summary:
      "An opaque protected cookie references a revocable server-side session with explicit lifecycle and assurance controls.",
    protocol: "HTTP cookie / database session",
    evolution: {
      then: "Server sessions let applications preserve authentication without resending credentials.",
      now: "Opaque cookies remain a strong browser default when fixation, expiry, rotation, revocation, and concurrency are handled.",
      next: "Require recent stronger proof for risky actions and use sender-constrained tokens for APIs that need theft resistance."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§5 Session Management",
        supports: ["assessment-context", "replay-resistance", "session-management"],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/session/"
      }),
      citeEvidence("rfc-9700", {
        section: "§2.2 Access Token Privilege Restriction",
        supports: ["threat-model", "token-security"]
      })
    ],
    tier: {
      track: "Sessions & tokens",
      grade: "A",
      rationale:
        "A strong browser default with straightforward server-side revocation and lifecycle control."
    },
    ratings: {
      setup: "high",
      phishingResistance: "not-applicable",
      replayResistance: "medium",
      recovery: "high"
    }
  },
  route: "/methods/sessions",
  panels,
  recorder: {
    journeys: ["session-lifecycle", "risk-step-up"] as const,
    operations: {
      "session-list": {
        endpoint: "/api/lab/sessions",
        method: "GET",
        success: "Owned session summaries and public lifecycle policy were returned without session tokens.",
        failure: "Session inspection required an authenticated owner."
      },
      "session-revoke-others": {
        endpoint: "/api/lab/sessions/others",
        method: "DELETE",
        success: "Every other session belonging to this account was revoked while the current session remained active.",
        failure: "Concurrent-session revocation required a fresh authenticated owner.",
        completesFlow: true
      },
      "risk-evaluate": {
        endpoint: "/api/lab/sessions/risk",
        method: "POST",
        success: "The policy allowed the operation using the current session and recent assurance.",
        failure: "The policy denied the risky operation until phishing-resistant step-up succeeds.",
        completesFlow: true
      },
      "risk-step-up-options": {
        endpoint: "/api/lab/passkeys/step-up/options",
        method: "POST",
        success: "A session-bound security-key challenge was issued for risk-triggered step-up.",
        failure: "No eligible roaming security key was available."
      },
      "risk-step-up-verify": {
        endpoint: "/api/lab/passkeys/step-up/verify",
        method: "POST",
        success: "Recent phishing-resistant assurance was attached to this session.",
        failure: "The proof was rejected for origin, expiry, replay, credential, or signature failure."
      }
    }
  }
} as const satisfies MethodAdapter;

export const dpopAdapter = {
  metadata: {
    slug: "dpop",
    name: "DPoP sender-constrained token",
    shortName: "DPoP",
    category: "Sessions",
    track: "Sessions & tokens",
    classification: "high-assurance",
    status: "interactive",
    summary:
      "A short-lived access token is bound to a client key and accepted only with a fresh signed request proof.",
    protocol: "OAuth DPoP / ES256",
    evolution: {
      then: "Bearer tokens could be replayed by anyone who obtained the token value.",
      now: "DPoP binds an application-layer access token to a public key and each HTTP request.",
      next: "Use DPoP for capable public clients; prefer mTLS where managed certificates and transport-level binding are appropriate."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("rfc-9449", {
        supports: ["protocol-definition", "replay-resistance", "token-security"]
      }),
      citeEvidence("rfc-8705", {
        supports: ["assessment-context", "protocol-definition", "token-security"]
      })
    ],
    tier: {
      track: "Sessions & tokens",
      grade: "A",
      rationale:
        "Proof of possession reduces replay after token theft, with client key and replay-cache complexity."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "not-applicable",
      replayResistance: "high",
      recovery: "medium"
    }
  },
  route: "/methods/sessions",
  panels,
  recorder: {
    journeys: ["dpop-resource"] as const,
    operations: {
      "dpop-issue": {
        endpoint: "/api/lab/dpop/token",
        method: "POST",
        success: "A five-minute access grant was bound to the browser's public key; no private key entered the server.",
        failure: "Token issuance required an authenticated session and a valid P-256 public key."
      },
      "dpop-resource": {
        endpoint: "/api/lab/dpop/resource",
        method: "GET",
        success: "The resource accepted the token only after validating key binding, method, URI, time, token hash, signature, and unique proof ID.",
        failure: "The resource rejected a missing, invalid, expired, mismatched, or replayed proof.",
        completesFlow: true
      },
      "dpop-replay": {
        endpoint: "/api/lab/dpop/resource",
        method: "GET",
        success: "Unexpectedly accepted a replayed proof.",
        failure: "The replay cache rejected the already-consumed proof ID.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const sessionTokenAdapters = [
  cookieSessionAdapter,
  dpopAdapter
] as const;
