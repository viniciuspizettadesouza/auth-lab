export type MethodStatus = "available" | "coming-later";
export type MethodCategory =
  | "Authentication"
  | "Passwordless"
  | "MFA"
  | "Federation"
  | "Sessions"
  | "Special environments"
  | "Machine authentication";

export type SecurityRating = "low" | "medium" | "high" | "depends";
export type TierGrade = "S" | "A" | "B" | "C" | "D";

export type AuthenticationMethod = {
  slug: string;
  name: string;
  shortName: string;
  category: MethodCategory;
  status: MethodStatus;
  summary: string;
  protocol: string;
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
    ratings: {
      setup: "high",
      phishingResistance: "depends",
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
    ratings: {
      setup: "medium",
      phishingResistance: "depends",
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
    ratings: {
      setup: "high",
      phishingResistance: "depends",
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
    ratings: {
      setup: "medium",
      phishingResistance: "depends",
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

export const comparisonMethods = authenticationMethods.filter((method) =>
  ["password", "magic-link", "totp", "passkey", "oidc"].includes(method.slug)
);

export const consumerWebTierList = [
  {
    grade: "S",
    label: "Preferred default",
    methodSlugs: ["passkey"],
    rationale:
      "Phishing-resistant, replay-resistant public-key authentication with no shared verifier secret."
  },
  {
    grade: "A",
    label: "Strong delegated identity",
    methodSlugs: ["oidc"],
    rationale:
      "Can centralize strong authentication and recovery, but the result inherits the identity provider's controls."
  },
  {
    grade: "B",
    label: "Useful additional layer",
    methodSlugs: ["totp"],
    rationale:
      "Widely deployable as a second factor, although manually entered codes remain phishable."
  },
  {
    grade: "C",
    label: "Transitional convenience",
    methodSlugs: ["magic-link", "email-otp"],
    rationale:
      "Removes a local password but moves trust and recovery to a phishable email channel."
  },
  {
    grade: "D",
    label: "Legacy baseline",
    methodSlugs: ["password"],
    rationale:
      "Still necessary in many systems, but a shared secret alone is replayable and vulnerable to phishing."
  }
] as const satisfies readonly {
  grade: TierGrade;
  label: string;
  methodSlugs: readonly string[];
  rationale: string;
}[];
