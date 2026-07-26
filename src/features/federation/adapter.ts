import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "User experience", note: "Real local redirect" },
  { id: "flow", title: "Flow", note: "RP and IdP actors" },
  { id: "network-inspector", title: "Network inspector", note: "No codes or tokens" },
  { id: "explanation", title: "Explanation", note: "Identity ≠ authorization" },
  { id: "comparison", title: "Comparison", note: "Federation track" }
] as const;

const evidenceDate = "2026-07-26";

export const oidcAdapter = {
  metadata: {
    slug: "oidc",
    name: "OpenID Connect",
    shortName: "OIDC",
    category: "Federation",
    track: "Federation & delegated authorization",
    classification: "recommended",
    status: "interactive",
    summary:
      "A local identity provider signs identity claims after Authorization Code with PKCE.",
    protocol: "OpenID Connect · Authorization Code + PKCE",
    evolution: {
      then: "OAuth solved delegated API access but did not itself define user authentication.",
      now: "OIDC adds an identity layer with issuer, audience, nonce, signed claims, discovery, and UserInfo.",
      next: "Use Authorization Code with PKCE and pair federation with deliberate linking, unlinking, and recovery."
    },
    evidenceDate,
    evidence: [
      citeEvidence("oidf-oidc-core-1.0", {
        supports: ["federation-security", "protocol-definition"]
      }),
      citeEvidence("rfc-9700", {
        supports: ["federation-security", "threat-model"]
      }),
      citeEvidence("rfc-7636", {
        supports: [
          "federation-security",
          "protocol-definition",
          "replay-resistance"
        ]
      })
    ],
    tier: {
      track: "Federation & delegated authorization",
      grade: "A",
      rationale:
        "The modern identity layer for web federation, with assurance inherited from the provider."
    },
    ratings: {
      setup: "high",
      phishingResistance: "depends",
      replayResistance: "high",
      recovery: "depends"
    }
  },
  route: "/methods/oidc",
  panels,
  recorder: {
    journeys: ["oidc-sign-in", "oidc-linking", "oidc-unlinking"] as const,
    operations: {
      "oidc-authorize": {
        endpoint: "/api/auth/sign-in/oauth2",
        method: "POST",
        success: "The relying party created state, nonce, and an S256 PKCE challenge, then redirected to the local provider.",
        failure: "The authorization request was rejected before leaving the relying party."
      },
      "oidc-link": {
        endpoint: "/api/auth/oauth2/link",
        method: "POST",
        success: "An authenticated user started an explicit provider-account linking ceremony.",
        failure: "Linking was rejected because there was no authenticated owner or the request was invalid."
      },
      "oidc-callback": {
        endpoint: "/api/auth/oauth2/callback/local-oidc",
        method: "GET",
        success: "State, issuer, PKCE, signature, audience, expiry, and nonce were validated before a local session was created.",
        failure: "The callback was rejected for a mismatch, conflict, expiry, replay, or invalid provider response.",
        completesFlow: true
      },
      "oidc-unlink": {
        endpoint: "/api/lab/federation/accounts",
        method: "DELETE",
        success: "The provider identity was unlinked while another local sign-in method remained.",
        failure: "Unlinking was rejected for ownership, freshness, or last-account safety.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const samlAdapter = {
  metadata: {
    slug: "saml",
    name: "Enterprise SSO",
    shortName: "SAML",
    category: "Federation",
    track: "Federation & delegated authorization",
    classification: "transitional",
    status: "simulation",
    summary:
      "A safe local walkthrough of a signed enterprise identity assertion.",
    protocol: "SAML 2.0 simulation",
    evolution: {
      then: "SAML standardized browser SSO across enterprise identity domains.",
      now: "It remains entrenched and capable, with XML, metadata, certificate, and deployment complexity.",
      next: "Prefer OpenID Connect for greenfield web and mobile federation when possible."
    },
    evidenceDate,
    evidence: [
      citeEvidence("oasis-saml-2.0", {
        supports: [
          "federation-security",
          "protocol-definition",
          "replay-resistance"
        ]
      })
    ],
    tier: {
      track: "Federation & delegated authorization",
      grade: "B",
      rationale:
        "Mature and common in enterprises, but more complex and less suited to new consumer systems."
    },
    ratings: {
      setup: "low",
      phishingResistance: "depends",
      replayResistance: "high",
      recovery: "depends"
    }
  },
  route: "/methods/saml",
  panels,
  recorder: {
    journeys: ["saml-simulation"] as const,
    operations: {
      "saml-simulate": {
        endpoint: "/api/lab/federation/saml",
        method: "POST",
        success: "The simulation checked issuer, audience, destination, time window, request correlation, and signature status.",
        failure: "The simulated assertion was rejected without accepting XML or creating a session.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const federationAdapters = [oidcAdapter, samlAdapter] as const;
