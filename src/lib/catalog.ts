import type {
  AuthenticationMethod,
  LearningTrack,
  MethodStatus,
  RecommendationClassification,
  TierGrade
} from "@/contracts";
import { interactiveMethodAdapters } from "@/features/method-registry";

export type {
  AuthenticationMethod,
  LearningTrack,
  MethodCategory,
  MethodStatus,
  RecommendationClassification,
  SecurityRating,
  TierGrade
} from "@/contracts";

const nistAuthenticators =
  "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/";
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
    evidence: [{ label: "NIST SP 800-63B §3.1.1", url: nistAuthenticators }],
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
    evidence: [{ label: "NIST SP 800-63B §3.1.1", url: nistAuthenticators }],
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
    evidence: [{ label: "NIST SP 800-63B §3.1.1.2", url: nistAuthenticators }],
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
    slug: "magic-link",
    name: "Magic link",
    shortName: "Magic link",
    category: "Passwordless",
    track: "Human authentication & MFA",
    classification: "transitional",
    status: "coming-later",
    summary: "A single-use link delivered to an email inbox.",
    protocol: "Single-use token",
    evolution: {
      then: "Email links removed the local password and its reset burden.",
      now: "The link is still a bearer proof whose assurance inherits the inbox and delivery path.",
      next: "Use origin-bound public-key credentials when phishing resistance is required."
    },
    evidenceDate,
    evidence: [{ label: "NIST SP 800-63B §3.1.3", url: nistAuthenticators }],
    tier: {
      track: "Human authentication & MFA",
      grade: "C",
      rationale:
        "Convenient, but authentication and recovery inherit the email account's risks."
    },
    ratings: {
      setup: "high",
      phishingResistance: "medium",
      replayResistance: "medium",
      recovery: "high"
    }
  },
  {
    slug: "email-otp",
    name: "Email OTP",
    shortName: "Email OTP",
    category: "Passwordless",
    track: "Human authentication & MFA",
    classification: "transitional",
    status: "coming-later",
    summary: "A short-lived code delivered over email.",
    protocol: "One-time password",
    evolution: {
      then: "Short codes worked across devices without a remembered local secret.",
      now: "Manual entry remains phishable and email is not an approved out-of-band authenticator.",
      next: "Reserve email for address confirmation and recovery; use stronger authenticators for sign-in."
    },
    evidenceDate,
    evidence: [{ label: "NIST SP 800-63B §3.1.3", url: nistAuthenticators }],
    tier: {
      track: "Human authentication & MFA",
      grade: "C",
      rationale:
        "Removes a local password but keeps a manually entered, phishable email proof."
    },
    ratings: {
      setup: "high",
      phishingResistance: "low",
      replayResistance: "medium",
      recovery: "high"
    }
  },
  {
    slug: "totp",
    name: "Authenticator app TOTP",
    shortName: "TOTP",
    category: "MFA",
    track: "Human authentication & MFA",
    classification: "transitional",
    status: "coming-later",
    summary: "A time-based code derived from a shared secret.",
    protocol: "RFC 6238",
    evolution: {
      then: "Authenticator apps brought a practical possession factor to ordinary phones.",
      now: "TOTP helps against password reuse but codes can be relayed by a real-time phishing site.",
      next: "Prefer phishing-resistant passkeys or security keys for new high-risk deployments."
    },
    evidenceDate,
    evidence: [
      { label: "RFC 6238", url: "https://www.rfc-editor.org/rfc/rfc6238" },
      { label: "NIST SP 800-63B §3.1.4", url: nistAuthenticators }
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "B",
      rationale:
        "A useful additional factor that remains vulnerable to real-time phishing."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "low",
      replayResistance: "medium",
      recovery: "medium"
    }
  },
  {
    slug: "passkey",
    name: "Passkey",
    shortName: "Passkey",
    category: "Passwordless",
    track: "Human authentication & MFA",
    classification: "recommended",
    status: "coming-later",
    summary: "A domain-bound public-key credential unlocked by the device.",
    protocol: "WebAuthn / FIDO2",
    evolution: {
      then: "Security keys proved that origin-bound public-key authentication could stop credential phishing.",
      now: "Passkeys make the same model broadly usable through platform and synced credentials.",
      next: "Design bootstrap, device loss, shared-device use, and recovery as carefully as authentication."
    },
    evidenceDate,
    evidence: [
      { label: "W3C WebAuthn Level 3", url: "https://www.w3.org/TR/webauthn-3/" }
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "S",
      rationale:
        "A phishing-resistant public-key default when enrollment and recovery are designed well."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "high",
      replayResistance: "high",
      recovery: "depends"
    }
  },
  {
    slug: "saml",
    name: "Enterprise SSO",
    shortName: "SAML",
    category: "Federation",
    track: "Federation & delegated authorization",
    classification: "transitional",
    status: "coming-later",
    summary: "XML assertions carry enterprise identity claims to a service provider.",
    protocol: "SAML 2.0",
    evolution: {
      then: "SAML standardized browser SSO across enterprise identity domains.",
      now: "It remains entrenched and capable, with XML and deployment complexity.",
      next: "Prefer OpenID Connect for greenfield web and mobile federation when possible."
    },
    evidenceDate,
    evidence: [
      {
        label: "OASIS SAML 2.0",
        url: "https://docs.oasis-open.org/security/saml/v2.0/"
      }
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
  {
    slug: "oidc",
    name: "OpenID Connect",
    shortName: "OIDC",
    category: "Federation",
    track: "Federation & delegated authorization",
    classification: "recommended",
    status: "coming-later",
    summary: "An identity provider authenticates the user for the application.",
    protocol: "OpenID Connect",
    evolution: {
      then: "OAuth solved delegated API access but did not itself define user authentication.",
      now: "OIDC adds an identity layer with issuer, audience, nonce, and signed identity claims.",
      next: "Use Authorization Code with PKCE and pair federation with deliberate account linking."
    },
    evidenceDate,
    evidence: [
      {
        label: "OpenID Connect Core 1.0",
        url: "https://openid.net/specs/openid-connect-core-1_0.html"
      },
      { label: "RFC 9700", url: "https://www.rfc-editor.org/rfc/rfc9700" }
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
      {
        label: "OpenID4VP 1.0",
        url: "https://openid.net/specs/openid-4-verifiable-presentations-1_0.html"
      }
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
      { label: "RFC 7519", url: "https://www.rfc-editor.org/rfc/rfc7519" }
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
      {
        label: "NIST SP 800-63B §5",
        url: "https://pages.nist.gov/800-63-4/sp800-63b/session/"
      }
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
      { label: "RFC 8628", url: "https://www.rfc-editor.org/rfc/rfc8628" }
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
      { label: "RFC 8705", url: "https://www.rfc-editor.org/rfc/rfc8705" }
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
      {
        label: "NIST SP 800-204A",
        url: "https://csrc.nist.gov/pubs/sp/800/204/a/final"
      }
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
      { label: "RFC 6749 §4.4", url: "https://www.rfc-editor.org/rfc/rfc6749#section-4.4" }
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
