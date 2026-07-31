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
    status: "simulation",
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
