import type {
  AuthenticationMethod,
  LearningTrack,
  MethodStatus,
  RecommendationClassification,
  TierGrade
} from "@/contracts";
import { interactiveMethodAdapters } from "@/features/method-registry";
import { citeEvidence } from "@/lib/evidence";

export type {
  AuthenticationMethod,
  LearningTrack,
  MethodCategory,
  MethodStatus,
  RecommendationClassification,
  SecurityRating,
  TierGrade
} from "@/contracts";

const evidenceDate = "2026-07-26";

export const authenticationMethods: AuthenticationMethod[] = [
  {
    slug: "security-questions",
    name: "Security questions",
    shortName: "Security questions",
    category: "Authentication",
    track: "Human authentication & MFA",
    classification: "historical",
    status: "simulation",
    summary:
      "Knowledge-based questions once acted as account proof and recovery.",
    protocol: "Knowledge-based authentication",
    evolution: {
      then: "Easy-to-deploy questions offered a second checkpoint without another device.",
      now: "Answers are guessable, discoverable, reusable, and explicitly discouraged by current guidance.",
      next: "Use bound authenticators and a deliberate recovery journey instead of personal trivia."
    },
    evidenceDate,
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.1 Passwords",
        supports: [
          "assessment-context",
          "authenticator-requirements",
          "phishing-resistance"
        ],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#passwords"
      })
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "D",
      rationale:
        "Personal knowledge is neither a reliable secret nor an independent factor."
    },
    ratings: {
      setup: "high",
      phishingResistance: "low",
      replayResistance: "low",
      recovery: "low"
    }
  },
  {
    slug: "server-pin",
    name: "Server-verified PIN",
    shortName: "Server PIN",
    category: "Authentication",
    track: "Human authentication & MFA",
    classification: "historical",
    status: "simulation",
    summary:
      "A short numeric secret sent to a central verifier as if it were a password.",
    protocol: "Centrally verified secret",
    evolution: {
      then: "Short PINs reduced typing on constrained keypads.",
      now: "A central PIN has a tiny guessing space and is not equivalent to a device-local unlock secret.",
      next: "Use a local activation PIN for a cryptographic authenticator, with verifier-side throttling."
    },
    evidenceDate,
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.1 Passwords and §3.2.10 Activation Secrets",
        supports: [
          "assessment-context",
          "authenticator-requirements",
          "phishing-resistance"
        ],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#activation-secrets"
      })
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "D",
      rationale:
        "A short centrally verified secret is vulnerable to guessing, phishing, and replay."
    },
    ratings: {
      setup: "high",
      phishingResistance: "low",
      replayResistance: "low",
      recovery: "medium"
    }
  },
  {
    slug: "forced-rotation",
    name: "Composition rules and forced rotation",
    shortName: "Forced rotation",
    category: "Authentication",
    track: "Human authentication & MFA",
    classification: "historical",
    status: "simulation",
    summary:
      "Complexity checklists and calendar-based changes tried to manufacture password strength.",
    protocol: "Legacy password policy",
    evolution: {
      then: "Frequent changes and character recipes were used as proxies for password quality.",
      now: "Predictable edits burden users without reliably stopping guessing or credential reuse.",
      next: "Prefer length, compromised-password screening, password managers, and changes after compromise."
    },
    evidenceDate,
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.1.2 Password Verifiers",
        supports: ["assessment-context", "password-policy"],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#password-verifiers"
      })
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "D",
      rationale:
        "Arbitrary recipes and periodic changes add friction without phishing resistance."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "low",
      replayResistance: "low",
      recovery: "low"
    }
  },
  ...interactiveMethodAdapters.map((adapter) => adapter.metadata),
  {
    slug: "verifiable-presentation",
    name: "Verifiable presentation",
    shortName: "OID4VP",
    category: "Federation",
    track: "Federation & delegated authorization",
    classification: "emerging",
    status: "coming-later",
    summary:
      "A wallet presents selected claims from portable credentials to a verifier.",
    protocol: "OpenID4VP",
    evolution: {
      then: "Federation tied identity claims to an online provider interaction.",
      now: "Wallet protocols can present holder-controlled credentials with selective disclosure.",
      next: "Track ecosystem trust, privacy, revocation, and interoperability before broad production use."
    },
    evidenceDate,
    evidence: [
      citeEvidence("oidf-openid4vp-1.0", {
        supports: [
          "assessment-context",
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
        "Promising portable identity with ecosystem and privacy choices that remain context-dependent."
    },
    ratings: {
      setup: "low",
      phishingResistance: "depends",
      replayResistance: "high",
      recovery: "depends"
    }
  },
  {
    slug: "jwt-session",
    name: "JWT session",
    shortName: "JWT",
    category: "Sessions",
    track: "Sessions & tokens",
    classification: "transitional",
    status: "coming-later",
    summary: "Signed claims carry session state without a database lookup.",
    protocol: "JWT",
    evolution: {
      then: "Self-contained tokens reduced shared session-state lookups.",
      now: "They are valuable for scoped authorization but complicate immediate browser-session revocation.",
      next: "Choose token shape from lifecycle needs; do not treat JWT as a login method."
    },
    evidenceDate,
    evidence: [
      citeEvidence("rfc-7519", {
        supports: ["protocol-definition"]
      }),
      citeEvidence("rfc-8725", {
        supports: ["threat-model", "token-security"]
      })
    ],
    tier: {
      track: "Sessions & tokens",
      grade: "B",
      rationale:
        "Useful for distributed authorization, but browser-session revocation and rotation require care."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "not-applicable",
      replayResistance: "medium",
      recovery: "medium"
    }
  },
  {
    slug: "cookie-session",
    name: "Database cookie session",
    shortName: "Cookie session",
    category: "Sessions",
    track: "Sessions & tokens",
    classification: "recommended",
    status: "interactive",
    summary: "An opaque cookie references a revocable server-side session.",
    protocol: "HTTP cookie",
    evolution: {
      then: "Server sessions let applications preserve authentication without resending credentials.",
      now: "Opaque, protected cookies provide a simple revocable browser-session default.",
      next: "Add rotation, expiry, concurrent-session controls, and step-up for sensitive actions."
    },
    evidenceDate,
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§5 Session Management",
        supports: [
          "assessment-context",
          "replay-resistance",
          "session-management"
        ],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/session/"
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
  {
    slug: "device-flow",
    name: "Device authorization",
    shortName: "Device flow",
    category: "Special environments",
    track: "Special environments",
    classification: "recommended",
    status: "coming-later",
    summary: "A constrained device delegates authorization to another browser.",
    protocol: "OAuth 2.0 Device Grant",
    evolution: {
      then: "TVs and command-line devices could not safely host ordinary redirect flows.",
      now: "The device grant moves user interaction to a capable browser while the device polls.",
      next: "Use it only for input-constrained clients and defend against code phishing."
    },
    evidenceDate,
    evidence: [
      citeEvidence("rfc-8628", {
        supports: [
          "assessment-context",
          "phishing-resistance",
          "protocol-definition",
          "replay-resistance"
        ]
      })
    ],
    tier: {
      track: "Special environments",
      grade: "A",
      rationale:
        "The appropriate standards-based choice for devices without a practical browser or keyboard."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "medium",
      replayResistance: "high",
      recovery: "depends"
    }
  },
  {
    slug: "mtls",
    name: "Client certificate",
    shortName: "mTLS",
    category: "Special environments",
    track: "Special environments",
    classification: "high-assurance",
    status: "coming-later",
    summary: "The client proves possession of a private key during TLS.",
    protocol: "mTLS / X.509",
    evolution: {
      then: "Managed certificates established strong client identity at the transport layer.",
      now: "mTLS provides sender constraint with significant issuance and lifecycle overhead.",
      next: "Use it where managed infrastructure and assurance needs justify certificate operations."
    },
    evidenceDate,
    evidence: [
      citeEvidence("rfc-8705", {
        supports: [
          "assessment-context",
          "phishing-resistance",
          "protocol-definition",
          "replay-resistance",
          "token-security"
        ]
      })
    ],
    tier: {
      track: "Special environments",
      grade: "A",
      rationale:
        "Strong proof of key possession for managed, high-assurance clients despite operational cost."
    },
    ratings: {
      setup: "low",
      phishingResistance: "high",
      replayResistance: "high",
      recovery: "low"
    }
  },
  {
    slug: "api-key",
    name: "API key",
    shortName: "API key",
    category: "Machine authentication",
    track: "Machine & workload identity",
    classification: "transitional",
    status: "coming-later",
    summary: "A long-lived shared secret identifies a workload or integration.",
    protocol: "Application-specific",
    evolution: {
      then: "A single copied string made API access easy to integrate.",
      now: "Long-lived bearer keys are difficult to scope, rotate, attribute, and contain after theft.",
      next: "Prefer short-lived, audience-bound workload credentials when the platform supports them."
    },
    evidenceDate,
    evidence: [
      citeEvidence("nist-sp-800-204a", {
        supports: [
          "assessment-context",
          "threat-model",
          "workload-identity"
        ]
      })
    ],
    tier: {
      track: "Machine & workload identity",
      grade: "C",
      rationale:
        "Simple and broadly compatible, but usually long-lived, replayable, and difficult to govern."
    },
    ratings: {
      setup: "high",
      phishingResistance: "not-applicable",
      replayResistance: "low",
      recovery: "high"
    }
  },
  {
    slug: "client-credentials",
    name: "OAuth client credentials",
    shortName: "Client credentials",
    category: "Machine authentication",
    track: "Machine & workload identity",
    classification: "recommended",
    status: "coming-later",
    summary: "A confidential client exchanges credentials for a scoped access token.",
    protocol: "OAuth 2.0",
    evolution: {
      then: "Static API keys mixed workload identity with authorization.",
      now: "Client credentials issue scoped, expiring tokens to a defined machine principal.",
      next: "Replace long-lived client secrets with assertions, certificates, or workload federation."
    },
    evidenceDate,
    evidence: [
      citeEvidence("rfc-6749", {
        section: "§4.4 Client Credentials Grant",
        supports: ["protocol-definition", "workload-identity"],
        url: "https://www.rfc-editor.org/rfc/rfc6749#section-4.4"
      }),
      citeEvidence("rfc-9700", {
        section: "§2.5 Client Authentication",
        supports: ["assessment-context", "threat-model", "workload-identity"],
        url: "https://www.rfc-editor.org/rfc/rfc9700#section-2.5"
      })
    ],
    tier: {
      track: "Machine & workload identity",
      grade: "A",
      rationale:
        "Scoped, expiring tokens improve workload access when client credentials are protected and rotated."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "not-applicable",
      replayResistance: "medium",
      recovery: "high"
    }
  }
];

export const classificationOrder = [
  "historical",
  "transitional",
  "recommended",
  "high-assurance",
  "emerging"
] as const satisfies readonly RecommendationClassification[];

export const classificationDetails = {
  historical: {
    label: "Historical",
    description:
      "Important for understanding the past; do not copy into a new system."
  },
  transitional: {
    label: "Transitional",
    description:
      "Still common or necessary, with known limits and a safer successor."
  },
  recommended: {
    label: "Recommended",
    description: "A standards-backed default for an appropriate 2026 use case."
  },
  "high-assurance": {
    label: "High assurance",
    description:
      "Stronger controls for high-risk contexts, with added cost and complexity."
  },
  emerging: {
    label: "Emerging",
    description:
      "Promising or newly standardized; evaluate maturity and interoperability."
  }
} as const satisfies Record<
  RecommendationClassification,
  { label: string; description: string }
>;

export const methodStatusLabels = {
  interactive: "Interactive",
  simulation: "Simulation",
  "coming-later": "Coming later"
} as const satisfies Record<MethodStatus, string>;

export const learningTracks = [
  {
    name: "Human authentication & MFA",
    shortName: "Human + MFA",
    context: "Primary and additional proof for people."
  },
  {
    name: "Federation & delegated authorization",
    shortName: "Federation",
    context: "External identity and delegated access."
  },
  {
    name: "Sessions & tokens",
    shortName: "Sessions",
    context: "Authenticated state and token lifecycle."
  },
  {
    name: "Special environments",
    shortName: "Special",
    context: "Constrained or managed high-assurance clients."
  },
  {
    name: "Machine & workload identity",
    shortName: "Workloads",
    context: "Non-human principals accessing services."
  }
] as const satisfies readonly {
  name: LearningTrack;
  shortName: string;
  context: string;
}[];

export const tierTracks = learningTracks;
export const tierGrades = ["S", "A", "B", "C", "D"] as const satisfies
  readonly TierGrade[];

// These aliases deliberately contain every catalog entry. Keeping all method
// metadata on AuthenticationMethod makes omissions a compile-time/test failure.
export const comparisonMethods = authenticationMethods;
export const tieredMethods = authenticationMethods;
