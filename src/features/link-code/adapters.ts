import { z } from "zod";

import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "User experience", note: "Real or labelled simulation" },
  { id: "flow", title: "Flow", note: "Ordered actors" },
  { id: "network-inspector", title: "Network inspector", note: "Sanitized projection" },
  { id: "explanation", title: "Explanation", note: "Threat model" },
  { id: "comparison", title: "Comparison", note: "Contextual" }
] as const;

const evidenceDate = "2026-07-26";

export const magicLinkAdapter = {
  metadata: {
    slug: "magic-link",
    name: "Magic link",
    shortName: "Magic link",
    category: "Passwordless",
    track: "Human authentication & MFA",
    classification: "transitional",
    status: "interactive",
    summary: "A five-minute, single-use bearer link delivered to an email inbox.",
    protocol: "Single-use token",
    evolution: {
      then: "Email links removed the local password and its reset burden.",
      now: "The link is still a bearer proof whose assurance inherits the inbox and delivery path.",
      next: "Use origin-bound public-key credentials when phishing resistance is required."
    },
    evidenceDate,
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.3 Out-of-Band Devices",
        supports: [
          "out-of-band-limitations",
          "phishing-resistance",
          "replay-resistance"
        ],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#out-of-band-devices"
      }),
      citeEvidence("owasp-forgot-password", {
        supports: ["implementation-guidance", "recovery"]
      })
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "C",
      rationale: "Convenient, but authentication and recovery inherit the email account's risks."
    },
    ratings: {
      setup: "high",
      phishingResistance: "medium",
      replayResistance: "medium",
      recovery: "high"
    }
  },
  route: "/methods/magic-link",
  panels,
  recorder: {
    journeys: ["magic-link"] as const,
    operations: {
      "magic-link-send": {
        endpoint: "/api/auth/sign-in/magic-link",
        method: "POST",
        success: "A generic response was returned and a single-use link was queued.",
        failure: "The link request was rejected without exposing account existence."
      }
    }
  }
} as const satisfies MethodAdapter<"magic-link", "magic-link-send">;

export const emailOtpAdapter = {
  metadata: {
    slug: "email-otp",
    name: "Email OTP",
    shortName: "Email OTP",
    category: "Passwordless",
    track: "Human authentication & MFA",
    classification: "transitional",
    status: "interactive",
    summary: "A six-digit, five-minute code delivered over email.",
    protocol: "One-time password",
    evolution: {
      then: "Short codes worked across devices without a remembered local secret.",
      now: "Manual entry remains phishable and email is not an approved out-of-band authenticator.",
      next: "Reserve email for address confirmation and recovery; use stronger authenticators for sign-in."
    },
    evidenceDate,
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.3 Out-of-Band Devices",
        supports: [
          "out-of-band-limitations",
          "phishing-resistance",
          "replay-resistance"
        ],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#out-of-band-devices"
      }),
      citeEvidence("owasp-forgot-password", {
        supports: ["implementation-guidance", "recovery"]
      })
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "C",
      rationale: "Removes a local password but keeps a manually entered, phishable email proof."
    },
    ratings: {
      setup: "high",
      phishingResistance: "low",
      replayResistance: "medium",
      recovery: "high"
    }
  },
  route: "/methods/email-otp",
  panels,
  recorder: {
    journeys: ["email-otp"] as const,
    operations: {
      "email-otp-send": {
        endpoint: "/api/auth/email-otp/send-verification-otp",
        method: "POST",
        success: "A rotating email code was queued with a five-minute lifetime.",
        failure: "The email-code request was rejected generically."
      },
      "email-otp-verify": {
        endpoint: "/api/auth/sign-in/email-otp",
        method: "POST",
        success: "The code was consumed and a database session was created.",
        failure: "The code was invalid, expired, consumed, or over its attempt limit.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter<
  "email-otp",
  "email-otp-send" | "email-otp-verify"
>;

export const totpAdapter = {
  metadata: {
    slug: "totp",
    name: "Authenticator app TOTP",
    shortName: "TOTP",
    category: "MFA",
    track: "Human authentication & MFA",
    classification: "transitional",
    status: "interactive",
    summary: "A time-based second factor with encrypted recovery codes.",
    protocol: "RFC 6238",
    evolution: {
      then: "Authenticator apps brought a practical possession factor to ordinary phones.",
      now: "TOTP helps against password reuse but codes can be relayed by a real-time phishing site.",
      next: "Prefer phishing-resistant passkeys or security keys for new high-risk deployments."
    },
    evidenceDate,
    evidence: [
      citeEvidence("rfc-6238", {
        supports: ["protocol-definition"]
      }),
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.4 Single-Factor OTP",
        supports: [
          "authenticator-requirements",
          "phishing-resistance",
          "replay-resistance"
        ],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#single-factor-otp"
      })
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "B",
      rationale: "A useful additional factor that remains vulnerable to real-time phishing."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "low",
      replayResistance: "medium",
      recovery: "medium"
    }
  },
  route: "/methods/totp",
  panels,
  recorder: {
    journeys: [
      "totp-enrollment",
      "totp-challenge",
      "totp-recovery",
      "totp-removal"
    ] as const,
    operations: {
      "totp-enable": {
        endpoint: "/api/auth/two-factor/enable",
        method: "POST",
        success: "A TOTP secret and one-time recovery codes were generated.",
        failure: "Enrollment was rejected."
      },
      "totp-verify": {
        endpoint: "/api/lab/totp/verify",
        method: "POST",
        success: "The time-based code was accepted.",
        failure: "The code was invalid, replayed outside its window, or locked.",
        completesFlow: true
      },
      "totp-disable": {
        endpoint: "/api/auth/two-factor/disable",
        method: "POST",
        success: "TOTP and its recovery material were removed.",
        failure: "TOTP removal was rejected.",
        completesFlow: true
      },
      "backup-code-verify": {
        endpoint: "/api/lab/totp/recover",
        method: "POST",
        success: "A recovery code was consumed.",
        failure: "The recovery code was invalid or already consumed.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter<
  "totp-enrollment" | "totp-challenge" | "totp-recovery" | "totp-removal",
  "totp-enable" | "totp-verify" | "totp-disable" | "backup-code-verify"
>;

export const smsOtpAdapter = {
  metadata: {
    slug: "sms-otp",
    name: "SMS OTP simulation",
    shortName: "SMS OTP",
    category: "MFA",
    track: "Human authentication & MFA",
    classification: "transitional",
    status: "simulation",
    summary: "A local-only simulation of a short code delivered to a synthetic phone.",
    protocol: "Simulated PSTN out-of-band code",
    evolution: {
      then: "SMS made a possession check available on almost every mobile phone.",
      now: "Delivery, interception, SIM swaps, number recycling, cost, and phishing limit its assurance.",
      next: "Use TOTP as a transitional factor or an origin-bound authenticator where possible."
    },
    evidenceDate,
    evidence: [
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.3.3 PSTN Use",
        supports: [
          "assessment-context",
          "out-of-band-limitations",
          "phishing-resistance"
        ],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#pstn-use"
      })
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "C",
      rationale: "Broad reach, but a restricted authenticator exposed to PSTN and account-recovery risks."
    },
    ratings: {
      setup: "medium",
      phishingResistance: "low",
      replayResistance: "medium",
      recovery: "low"
    }
  },
  route: "/methods/sms-otp",
  panels,
  recorder: {
    journeys: ["sms-otp-simulation"] as const,
    operations: {
      "sms-otp-send": {
        endpoint: "/api/lab/sms",
        method: "POST",
        success: "A synthetic SMS code was generated for the local simulator.",
        failure: "The simulated delivery was rejected or throttled."
      },
      "sms-otp-verify": {
        endpoint: "/api/lab/sms/verify",
        method: "POST",
        success: "The synthetic code was consumed.",
        failure: "The synthetic code was invalid, expired, or already consumed.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter<
  "sms-otp-simulation",
  "sms-otp-send" | "sms-otp-verify"
>;

export const milestone3Adapters = [
  magicLinkAdapter,
  emailOtpAdapter,
  totpAdapter,
  smsOtpAdapter
] as const;

export const milestone3JourneySchema = z.enum([
  "magic-link",
  "email-otp",
  "totp-enrollment",
  "totp-challenge",
  "totp-recovery",
  "totp-removal",
  "sms-otp-simulation"
]);

export const milestone3AuthEndpointDescriptions = {
  "/sign-in/magic-link": {
    action: "magic-link.requested",
    description: "The browser requested a single-use email sign-in link.",
    fields: ["email", "callbackURL"]
  },
  "/magic-link/verify": {
    action: "magic-link.verified",
    description: "The application received a single-use magic-link proof.",
    fields: [],
    completesSession: true
  },
  "/email-otp/send-verification-otp": {
    action: "email-otp.requested",
    description: "The browser requested a rotating email sign-in code.",
    fields: ["email"]
  },
  "/sign-in/email-otp": {
    action: "email-otp.submitted",
    description: "The browser submitted an email address and one-time code.",
    fields: ["email"]
  },
  "/two-factor/enable": {
    action: "totp.enrollment-started",
    description: "The user requested a new TOTP enrollment ceremony.",
    fields: ["password"]
  },
  "/two-factor/verify-totp": {
    action: "totp.submitted",
    description: "The browser submitted a time-based code.",
    fields: []
  },
  "/two-factor/verify-backup-code": {
    action: "totp.recovery-submitted",
    description: "The browser submitted a one-time recovery code.",
    fields: []
  },
  "/two-factor/disable": {
    action: "totp.disabled",
    description: "The user requested removal of the TOTP factor.",
    fields: ["password"]
  }
} as const;
