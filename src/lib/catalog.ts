export type MethodStatus = "available" | "coming-later";
export type MethodCategory =
  | "Authentication"
  | "Passwordless"
  | "MFA"
  | "Federation"
  | "Sessions"
  | "Special environments"
  | "Machine authentication";

export type SecurityRating =
  | "low"
  | "medium"
  | "high"
  | "depends"
  | "not-applicable";
export type TierGrade = "S" | "A" | "B" | "C" | "D";
export type TierTrack =
  | "Human authentication & MFA"
  | "Federation"
  | "Sessions"
  | "Special environments"
  | "Machine authentication";

export type AuthenticationMethod = {
  slug: string;
  name: string;
  shortName: string;
  category: MethodCategory;
  status: MethodStatus;
  summary: string;
  protocol: string;
  tier: {
    track: TierTrack;
    grade: TierGrade;
    rationale: string;
  };
  ratings: {
    setup: SecurityRating;
    phishingResistance: SecurityRating;
    replayResistance: SecurityRating;
    recovery: SecurityRating;
  };
};

export const authenticationMethods: AuthenticationMethod[] = [
  {
    slug: "password",
    name: "Email and password",
    shortName: "Password",
    category: "Authentication",
    status: "available",
    summary: "A shared secret verified by the application and bound to a session.",
    protocol: "Application-specific",
    tier: {
      track: "Human authentication & MFA",
      grade: "D",
      rationale:
        "A shared secret alone is replayable and vulnerable to phishing."
    },
    ratings: {
      setup: "high",
      phishingResistance: "low",
      replayResistance: "medium",
      recovery: "high"
    }
  },
  {
    slug: "magic-link",
    name: "Magic link",
    shortName: "Magic link",
    category: "Passwordless",
    status: "coming-later",
    summary: "A single-use link delivered to an email inbox.",
    protocol: "Single-use token",
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
    status: "coming-later",
    summary: "A short-lived code delivered over email.",
    protocol: "One-time password",
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
    status: "coming-later",
    summary: "A time-based code derived from a shared secret.",
    protocol: "RFC 6238",
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
    status: "coming-later",
    summary: "A domain-bound public-key credential unlocked by the device.",
    protocol: "WebAuthn / FIDO2",
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
    slug: "oidc",
    name: "OpenID Connect",
    shortName: "OIDC",
    category: "Federation",
    status: "coming-later",
    summary: "An identity provider authenticates the user for the application.",
    protocol: "OpenID Connect",
    tier: {
      track: "Federation",
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
    slug: "saml",
    name: "Enterprise SSO",
    shortName: "SAML",
    category: "Federation",
    status: "coming-later",
    summary: "XML assertions carry enterprise identity claims to a service provider.",
    protocol: "SAML 2.0",
    tier: {
      track: "Federation",
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
    slug: "cookie-session",
    name: "Database cookie session",
    shortName: "Cookie session",
    category: "Sessions",
    status: "available",
    summary: "An opaque cookie references a revocable server-side session.",
    protocol: "HTTP cookie",
    tier: {
      track: "Sessions",
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
    slug: "jwt-session",
    name: "JWT session",
    shortName: "JWT",
    category: "Sessions",
    status: "coming-later",
    summary: "Signed claims carry session state without a database lookup.",
    protocol: "JWT",
    tier: {
      track: "Sessions",
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
    slug: "device-flow",
    name: "Device authorization",
    shortName: "Device flow",
    category: "Special environments",
    status: "coming-later",
    summary: "A constrained device delegates authentication to another browser.",
    protocol: "OAuth 2.0 Device Grant",
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
    status: "coming-later",
    summary: "The client proves possession of a private key during TLS.",
    protocol: "mTLS / X.509",
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
    status: "coming-later",
    summary: "A long-lived shared secret identifies a workload or integration.",
    protocol: "Application-specific",
    tier: {
      track: "Machine authentication",
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
    status: "coming-later",
    summary: "A confidential client exchanges credentials for a scoped access token.",
    protocol: "OAuth 2.0",
    tier: {
      track: "Machine authentication",
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

export const methodCategories = [
  "Authentication",
  "Passwordless",
  "MFA",
  "Federation",
  "Sessions",
  "Special environments",
  "Machine authentication"
] as const satisfies readonly MethodCategory[];

export const tierTracks = [
  {
    name: "Human authentication & MFA",
    context: "Primary and additional proof for a new consumer web application."
  },
  {
    name: "Federation",
    context: "Delegating human identity to an external identity provider."
  },
  {
    name: "Sessions",
    context: "Maintaining authenticated browser state after sign-in."
  },
  {
    name: "Special environments",
    context: "Purpose-built choices for constrained or managed clients."
  },
  {
    name: "Machine authentication",
    context: "Non-human workloads accessing APIs and services."
  }
] as const satisfies readonly { name: TierTrack; context: string }[];

export const tierGrades = ["S", "A", "B", "C", "D"] as const satisfies
  readonly TierGrade[];

// These aliases deliberately contain every catalog entry. Keeping all method
// metadata on AuthenticationMethod makes omissions a compile-time/test failure.
export const comparisonMethods = authenticationMethods;
export const tieredMethods = authenticationMethods;
