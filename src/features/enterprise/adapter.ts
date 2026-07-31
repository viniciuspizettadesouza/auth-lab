import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "User experience", note: "Local policy ceremonies" },
  { id: "flow", title: "Flow", note: "Tenant and trust boundaries" },
  { id: "network-inspector", title: "Network inspector", note: "No keys or assertions" },
  { id: "explanation", title: "Explanation", note: "Lifecycle included" },
  { id: "comparison", title: "Comparison", note: "High-assurance contexts" }
] as const;

export const enterpriseSsoAdapter = {
  metadata: {
    slug: "enterprise-sso",
    name: "Tenant-aware enterprise SSO",
    shortName: "Enterprise SSO",
    category: "Federation",
    track: "Federation & delegated authorization",
    classification: "recommended",
    status: "simulation",
    summary:
      "A tenant policy boundary applies domain discovery, issuer ownership, subject mapping, enforcement, and recovery to OIDC and SAML.",
    protocol: "Enterprise OIDC / SAML 2.0",
    evolution: {
      then: "Enterprise SSO centralized workforce authentication and account lifecycle around a directory.",
      now: "OIDC is preferred for greenfield applications while SAML remains common; both require tenant-aware issuer and subject ownership.",
      next: "Separate authentication from provisioning, enforce SSO per organization, and retain a controlled break-glass recovery path."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("oidf-oidc-core-1.0", {
        supports: ["federation-security", "protocol-definition"]
      }),
      citeEvidence("oasis-saml-2.0", {
        supports: ["federation-security", "protocol-definition", "replay-resistance"]
      }),
      citeEvidence("rfc-9700", {
        supports: ["federation-security", "threat-model"]
      })
    ],
    tier: {
      track: "Federation & delegated authorization",
      grade: "A",
      rationale:
        "A strong workforce default when tenant discovery, claim mapping, recovery, and provider assurance are governed."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "depends",
      replayResistance: "high",
      recovery: "depends"
    }
  },
  route: "/methods/enterprise",
  panels,
  recorder: {
    journeys: ["enterprise-sso-policy"] as const,
    operations: {
      "enterprise-discover": {
        endpoint: "/api/lab/enterprise/sso",
        method: "GET",
        success: "The email domain resolved to one owned tenant and its configured enterprise protocol.",
        failure: "No enterprise tenant owned this domain."
      },
      "enterprise-evaluate": {
        endpoint: "/api/lab/enterprise/sso",
        method: "POST",
        success: "Tenant, issuer, audience, subject, time, signature, and group policy passed before membership mapping.",
        failure: "The simulated enterprise response failed closed at the tenant policy boundary.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const fapiAdapter = {
  metadata: {
    slug: "fapi",
    name: "FAPI 2.0 client controls",
    shortName: "FAPI 2.0",
    category: "Special environments",
    track: "Special environments",
    classification: "high-assurance",
    status: "interactive",
    summary:
      "A lab implementation of FAPI control concepts: private-key client authentication and certificate-bound tokens.",
    protocol: "private_key_jwt + mTLS binding lab",
    evolution: {
      then: "Shared client secrets were copied between high-value integrations and were difficult to attribute safely.",
      now: "FAPI 2.0 requires asymmetric client authentication and sender-constrained access tokens for high-security APIs.",
      next: "Use certified implementations, PAR, hardened discovery, operational key rotation, and ecosystem-specific conformance testing."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("oidf-fapi-2.0-security-profile", {
        section: "§5.3 Profile and §5.4 Cryptography",
        supports: ["assessment-context", "protocol-definition", "token-security"]
      }),
      citeEvidence("rfc-7523", {
        supports: ["protocol-definition", "replay-resistance", "token-security"]
      }),
      citeEvidence("rfc-8705", {
        supports: ["protocol-definition", "replay-resistance", "token-security"]
      })
    ],
    tier: {
      track: "Special environments",
      grade: "S",
      rationale:
        "A rigorous profile for high-value APIs, with substantial conformance and operational cost."
    },
    ratings: {
      setup: "low",
      phishingResistance: "high",
      replayResistance: "high",
      recovery: "low"
    }
  },
  route: "/methods/enterprise",
  panels,
  recorder: {
    journeys: ["fapi-client"] as const,
    operations: {
      "fapi-register": {
        endpoint: "/api/lab/enterprise/fapi/register",
        method: "POST",
        success: "The lab registered a confidential client's public key and synthetic certificate thumbprint.",
        failure: "Registration rejected an unsupported public key."
      },
      "fapi-token": {
        endpoint: "/api/lab/enterprise/fapi/token",
        method: "POST",
        success: "The server verified the private-key JWT and synthetic TLS certificate binding before issuing a short-lived token.",
        failure: "Client authentication failed for signature, audience, time, replay, or certificate mismatch."
      },
      "fapi-resource": {
        endpoint: "/api/lab/enterprise/fapi/resource",
        method: "GET",
        success: "The resource accepted the token only with its bound active certificate thumbprint.",
        failure: "The resource rejected token theft, certificate mismatch, expiry, or revocation.",
        completesFlow: true
      },
      "fapi-replay": {
        endpoint: "/api/lab/enterprise/fapi/token",
        method: "POST",
        success: "Unexpectedly accepted a reused client assertion.",
        failure: "The replay cache rejected the already-consumed private-key JWT identifier.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const mtlsAdapter = {
  metadata: {
    slug: "mtls",
    name: "mTLS certificate lifecycle",
    shortName: "mTLS",
    category: "Special environments",
    track: "Special environments",
    classification: "high-assurance",
    status: "simulation",
    summary:
      "A transport-boundary simulation demonstrates certificate authentication, token binding, overlap rotation, and revocation.",
    protocol: "OAuth mTLS / X.509 simulation",
    evolution: {
      then: "Managed certificates established strong client identity at the transport layer.",
      now: "mTLS authenticates managed clients and constrains tokens, with significant issuance, proxy, and lifecycle requirements.",
      next: "Use it where managed infrastructure justifies certificate operations and protect client-certificate metadata across TLS termination."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("rfc-8705", {
        supports: ["assessment-context", "protocol-definition", "replay-resistance", "token-security"]
      }),
      citeEvidence("oidf-fapi-2.0-security-profile", {
        section: "§5.2.2.1 MTLS ecosystems",
        supports: ["assessment-context", "token-security"]
      })
    ],
    tier: {
      track: "Special environments",
      grade: "A",
      rationale:
        "Strong managed-client proof and sender constraint, balanced by certificate lifecycle complexity."
    },
    ratings: {
      setup: "low",
      phishingResistance: "high",
      replayResistance: "high",
      recovery: "low"
    }
  },
  route: "/methods/enterprise",
  panels,
  recorder: {
    journeys: ["certificate-lifecycle"] as const,
    operations: {
      "certificate-rotate": {
        endpoint: "/api/lab/enterprise/fapi/certificate",
        method: "POST",
        success: "A new synthetic certificate became active with a short overlap window for the previous certificate.",
        failure: "Rotation required an existing active managed client."
      },
      "certificate-revoke": {
        endpoint: "/api/lab/enterprise/fapi/certificate",
        method: "DELETE",
        success: "The client certificate was revoked and certificate-bound resource access stopped.",
        failure: "Revocation required an existing managed client.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const smartcardAdapter = {
  metadata: {
    slug: "smartcard-directory",
    name: "Smartcard and enterprise directory",
    shortName: "Smartcard",
    category: "MFA",
    track: "Human authentication & MFA",
    classification: "high-assurance",
    status: "simulation",
    summary:
      "A safe simulation separates local card activation, certificate validation, directory status, group mapping, and session creation.",
    protocol: "PIV-style smartcard / directory simulation",
    evolution: {
      then: "Managed smartcards bound workforce identities to issued cryptographic credentials and central directories.",
      now: "They remain valuable in regulated environments but depend on readers, PKI, revocation, directory hygiene, and recovery operations.",
      next: "Choose managed phishing-resistant authenticators that fit the workforce and preserve auditable issuance and revocation."
    },
    evidenceDate: "2026-07-31",
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.7 Cryptographic Authenticators",
        supports: ["assessment-context", "authenticator-requirements", "phishing-resistance", "recovery"]
      })
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "A",
      rationale:
        "High-assurance managed authentication with considerable hardware, PKI, and help-desk cost."
    },
    ratings: {
      setup: "low",
      phishingResistance: "high",
      replayResistance: "high",
      recovery: "low"
    }
  },
  route: "/methods/enterprise",
  panels,
  recorder: {
    journeys: ["smartcard-directory"] as const,
    operations: {
      "smartcard-simulate": {
        endpoint: "/api/lab/enterprise/smartcard",
        method: "POST",
        success: "The simulation validated card status, certificate trust, directory ownership, and group policy without accepting a PIN or certificate.",
        failure: "The modeled card, certificate, directory, or group policy failed closed without creating a session.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const enterpriseAdapters = [
  enterpriseSsoAdapter,
  fapiAdapter,
  mtlsAdapter,
  smartcardAdapter
] as const;
