import type { MethodAdapter } from "@/contracts";
import { citeEvidence } from "@/lib/evidence";

const panels = [
  { id: "user-experience", title: "User experience", note: "Real WebAuthn ceremony" },
  { id: "flow", title: "Flow", note: "Origin-bound actors" },
  { id: "network-inspector", title: "Network inspector", note: "Public data only" },
  { id: "explanation", title: "Explanation", note: "Recovery included" },
  { id: "comparison", title: "Comparison", note: "Contextual" }
] as const;

export const passkeyAdapter = {
  metadata: {
    slug: "passkey",
    name: "Passkeys and security keys",
    shortName: "Passkey",
    category: "Passwordless",
    track: "Human authentication & MFA",
    classification: "recommended",
    status: "interactive",
    summary:
      "Discoverable, origin-bound public-key credentials unlocked with local user verification.",
    protocol: "WebAuthn / FIDO2",
    evolution: {
      then: "Roaming security keys proved that origin-bound public-key authentication could stop credential phishing.",
      now: "Discoverable platform and synced passkeys make that model usable for broad consumer and workforce sign-in.",
      next: "Choose synced or device-bound credentials deliberately and design bootstrap, shared-device use, device loss, and recovery."
    },
    evidenceDate: "2026-07-26",
    evidence: [
      citeEvidence("w3c-webauthn-2", {
        supports: [
          "phishing-resistance",
          "protocol-definition",
          "replay-resistance"
        ]
      }),
      citeEvidence("w3c-webauthn-3", {
        supports: ["protocol-definition"]
      }),
      citeEvidence("fido-ctap-2.3", {
        supports: ["authenticator-requirements", "protocol-definition"]
      }),
      citeEvidence("nist-sp-800-63b-4", {
        section: "§3.1.7 Cryptographic Authenticators",
        supports: [
          "assessment-context",
          "authenticator-requirements",
          "phishing-resistance",
          "recovery",
          "replay-resistance"
        ],
        url: "https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#single-factor-cryptographic-authentication"
      })
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
  route: "/methods/passkey",
  panels,
  recorder: {
    journeys: [
      "passkey-enrollment",
      "passkey-authentication",
      "passkey-revocation",
      "security-key-step-up"
    ] as const,
    operations: {
      "passkey-register": {
        endpoint: "/api/auth/passkey/verify-registration",
        method: "POST",
        success: "User verification succeeded and the public-key credential was linked to the signed-in account.",
        failure: "Registration was cancelled or rejected for an invalid origin, expired challenge, replay, or missing user verification.",
        completesFlow: true
      },
      "passkey-authenticate": {
        endpoint: "/api/auth/passkey/verify-authentication",
        method: "POST",
        success: "The discoverable credential, origin, challenge, signature, counter, and user verification were accepted.",
        failure: "Authentication was cancelled or rejected without falling back to a weaker proof.",
        completesFlow: true
      },
      "passkey-delete": {
        endpoint: "/api/lab/passkeys",
        method: "DELETE",
        success: "The selected public-key credential and its assurance label were revoked.",
        failure: "Revocation was rejected because the credential was missing or belonged to another account.",
        completesFlow: true
      },
      "security-key-step-up-options": {
        endpoint: "/api/lab/passkeys/step-up/options",
        method: "POST",
        success: "A five-minute, session-bound challenge was issued for registered roaming security keys.",
        failure: "No eligible security key or authenticated session was available."
      },
      "security-key-step-up-verify": {
        endpoint: "/api/lab/passkeys/step-up/verify",
        method: "POST",
        success: "The roaming key completed user-verified, origin-bound step-up without creating another session.",
        failure: "Step-up was rejected for origin mismatch, expiry, replay, downgrade, or invalid signature.",
        completesFlow: true
      }
    }
  }
} as const satisfies MethodAdapter;

export const passkeyAuthEndpointDescriptions = {
  "/passkey/generate-register-options": {
    action: "passkey.registration-options",
    description: "The server issued a short-lived challenge bound to this relying party and account.",
    fields: ["name"]
  },
  "/passkey/verify-registration": {
    action: "passkey.registration-verified",
    description: "The server verified origin, relying-party ID, challenge, signature, and local user verification.",
    fields: []
  },
  "/passkey/generate-authenticate-options": {
    action: "passkey.authentication-options",
    description: "The server issued a discoverable-credential challenge without requesting an email address.",
    fields: []
  },
  "/passkey/verify-authentication": {
    action: "passkey.authentication-verified",
    description: "The server accepted an origin-bound assertion and advanced its replay counter.",
    fields: [],
    completesSession: true
  }
} as const;
