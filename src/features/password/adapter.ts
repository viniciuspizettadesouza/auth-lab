import { z } from "zod";

import type { MethodAdapter } from "@/contracts";

export const passwordJourneys = [
  "sign-up",
  "sign-in",
  "password-reset",
  "session"
] as const;

export const passwordOperations = [
  "sign-up",
  "sign-in",
  "sign-out",
  "request-reset",
  "reset-password",
  "list-sessions",
  "revoke-session"
] as const;

export type PasswordJourney = (typeof passwordJourneys)[number];
export type PasswordOperation = (typeof passwordOperations)[number];

export const passwordMethodAdapter = {
  metadata: {
    slug: "password",
    name: "Email and password",
    shortName: "Password",
    category: "Authentication",
    track: "Human authentication & MFA",
    classification: "transitional",
    status: "interactive",
    summary: "A shared secret verified by the application and bound to a session.",
    protocol: "Application-specific",
    evolution: {
      then: "Passwords made remote authentication cheap and universally deployable.",
      now: "They remain compatible and recoverable, but require blocklists, throttling, safe hashing, and password-manager support.",
      next: "Offer passkeys where the ecosystem and recovery design can support them."
    },
    evidenceDate: "2026-07-26",
    evidence: [
      {
        label: "NIST SP 800-63B §3.1.1",
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/"
      }
    ],
    tier: {
      track: "Human authentication & MFA",
      grade: "D",
      rationale: "A shared secret alone is replayable and vulnerable to phishing."
    },
    ratings: {
      setup: "high",
      phishingResistance: "low",
      replayResistance: "medium",
      recovery: "high"
    }
  },
  route: "/methods/password",
  panels: [
    { id: "user-experience", title: "User experience", note: "Real flow" },
    { id: "flow", title: "Flow", note: "Ordered events" },
    {
      id: "network-inspector",
      title: "Network inspector",
      note: "Sanitized projection"
    },
    { id: "explanation", title: "Explanation", note: "Threat model" },
    { id: "comparison", title: "Comparison", note: "Contextual" }
  ],
  recorder: {
    journeys: passwordJourneys,
    operations: {
      "sign-up": {
        endpoint: "/api/auth/sign-up/email",
        method: "POST",
        success: "Registration was accepted and verification is now required.",
        failure: "Registration did not complete; the safe error was shown to the user."
      },
      "sign-in": {
        endpoint: "/api/auth/sign-in/email",
        method: "POST",
        success: "Credentials were verified and a database session was created.",
        failure: "Authentication failed without revealing which credential was wrong."
      },
      "sign-out": {
        endpoint: "/api/auth/sign-out",
        method: "POST",
        success: "The current session was terminated.",
        failure: "The sign-out request could not be completed."
      },
      "request-reset": {
        endpoint: "/api/auth/request-password-reset",
        method: "POST",
        success: "A generic reset response was returned regardless of account existence.",
        failure: "The reset request could not be accepted."
      },
      "reset-password": {
        endpoint: "/api/auth/reset-password",
        method: "POST",
        success: "The password was replaced and previous sessions were revoked.",
        failure: "The reset proof or replacement password was rejected."
      },
      "list-sessions": {
        endpoint: "/api/lab/sessions",
        method: "GET",
        success: "Active session summaries were returned without their tokens.",
        failure: "Session summaries could not be loaded."
      },
      "revoke-session": {
        endpoint: "/api/lab/sessions/:id",
        method: "DELETE",
        success: "The selected server-side session was revoked by ID.",
        failure: "The selected session could not be revoked."
      }
    }
  }
} as const satisfies MethodAdapter<PasswordJourney, PasswordOperation>;

export const passwordJourneySchema = z.enum(passwordJourneys);
export const passwordClientEventSchema = z.object({
  operation: z.enum(passwordOperations),
  outcome: z.enum(["success", "failure"]),
  statusCode: z.number().int().min(100).max(599),
  durationMs: z.number().int().min(0).max(120_000)
});

export const passwordAuthEndpointDescriptions = {
  "/sign-up/email": {
    action: "signup.requested",
    description: "The browser submitted registration fields to the application.",
    fields: ["name", "email", "password", "callbackURL"]
  },
  "/sign-in/email": {
    action: "signin.requested",
    description: "The browser submitted an email and password for verification.",
    fields: ["email", "password", "rememberMe"]
  },
  "/sign-out": {
    action: "signout.requested",
    description: "The browser requested termination of the current session.",
    fields: []
  },
  "/request-password-reset": {
    action: "reset.requested",
    description: "The browser requested a password reset email.",
    fields: ["email"]
  },
  "/reset-password": {
    action: "reset.submitted",
    description: "The browser submitted a replacement password with a reset proof.",
    fields: ["newPassword"]
  },
  "/verify-email": {
    action: "email.verify",
    description: "The application received a single-use email verification proof.",
    fields: []
  },
  "/list-sessions": {
    action: "sessions.listed",
    description: "The application loaded the user's active database sessions.",
    fields: []
  },
  "/revoke-session": {
    action: "session.revoked",
    description: "The user revoked one selected database session.",
    fields: []
  },
  "/revoke-other-sessions": {
    action: "sessions.others-revoked",
    description: "The user revoked every session except the current one.",
    fields: []
  }
} as const;

export const passwordExplanation = [
  ["User provides", "An email identifier and a reusable shared secret."],
  ["Server stores", "A one-way password hash in the credential account, never the original password."],
  ["Identity verifier", "The application compares the submitted password against that hash."],
  ["Current policy", "At least 15 characters, up to 128, with no arbitrary character recipe or periodic rotation."],
  ["Blocklist", "New passwords are compared in full against common, compromised, and service-specific values."],
  ["Online guessing", "Sign-in and reset endpoints are rate-limited in every environment; production also needs distributed, account-aware abuse controls."],
  ["Phishing resistance", "Low. A convincing origin can capture and relay both fields."],
  ["Replay resistance", "Session cookies reduce repeated password use, but stolen credentials remain reusable."],
  ["Recovery", "A short-lived, single-use proof delivered to the verified email inbox."],
  ["Session", "An opaque HttpOnly cookie references a revocable PostgreSQL record."],
  ["Operational cost", "Password policy, abuse controls, email delivery, reset flows, and breach response."]
] as const;
