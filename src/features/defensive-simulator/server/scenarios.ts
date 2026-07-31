export const defensiveScenarioIds = [
  "reused-password",
  "credential-stuffing",
  "captured-magic-link",
  "captured-otp",
  "push-fatigue",
  "recovery-abuse",
  "session-fixation",
  "token-expiry-replay-revocation",
  "missing-oauth-state",
  "invalid-redirect-uri",
  "email-only-account-linking",
  "phishing-vs-webauthn",
  "bearer-vs-sender-constrained"
] as const;

export type DefensiveScenarioId = typeof defensiveScenarioIds[number];
export type DefensiveFamily = "Credentials" | "Links, codes & recovery" | "Sessions & OAuth" | "Origin & token binding";
export type DefensiveStep = {
  actor: string;
  action: string;
  outcome: "blocked" | "contained" | "exposed" | "observed";
};
export type DefensiveResult = {
  consequence: string;
  controls: string[];
  executed: false;
  family: DefensiveFamily;
  id: DefensiveScenarioId;
  limitation: string;
  steps: DefensiveStep[];
  summary: string;
  synthetic: true;
  title: string;
};

const scenarios: Record<DefensiveScenarioId, Omit<DefensiveResult, "executed" | "id" | "synthetic">> = {
  "reused-password": {
    title: "Reused password",
    family: "Credentials",
    summary: "A synthetic password exposed at another service is reused against the matching demo identity.",
    consequence: "A password verifier cannot tell whether the person or an attacker typed a valid reused secret.",
    controls: ["compromised-password screening", "password manager", "rate limiting", "phishing-resistant authentication"],
    limitation: "The lab models the consequence and defenses; it never accepts or tests a real password.",
    steps: [
      { actor: "unrelated synthetic service", action: "marks a demo password as exposed", outcome: "exposed" },
      { actor: "Auth Lab verifier", action: "screens the prospective value against its local blocklist", outcome: "blocked" },
      { actor: "account owner", action: "uses a unique managed password or passkey instead", outcome: "contained" }
    ]
  },
  "credential-stuffing": {
    title: "Simulated credential stuffing",
    family: "Credentials",
    summary: "A fixed synthetic burst represents reused-credential attempts without generating login traffic.",
    consequence: "Valid reused credentials can cause takeover; invalid bursts can still consume capacity and reveal weak abuse controls.",
    controls: ["generic failures", "per-account and network throttling", "breached-password screening", "risk signals", "passkeys"],
    limitation: "No request loop, target, credential list, concurrency setting, or offensive output exists.",
    steps: [
      { actor: "scenario engine", action: "loads a fixed synthetic burst label", outcome: "observed" },
      { actor: "rate limiter", action: "coalesces responses and closes the attempt window", outcome: "blocked" },
      { actor: "monitoring", action: "records an abuse signal without account enumeration", outcome: "contained" }
    ]
  },
  "captured-magic-link": {
    title: "Captured magic link",
    family: "Links, codes & recovery",
    summary: "A synthetic link is observed before use to show that possession is bearer authority.",
    consequence: "The first holder could authenticate unless channel, device, transaction, and user expectations reduce interception risk.",
    controls: ["short expiry", "atomic single use", "purpose binding", "user notification", "origin-bound successor"],
    limitation: "No link value, mailbox, URL, or token is created or exposed by this scenario.",
    steps: [
      { actor: "synthetic channel", action: "reports that a bearer link was observed", outcome: "exposed" },
      { actor: "link verifier", action: "consumes the record atomically on first valid use", outcome: "contained" },
      { actor: "replay attempt", action: "finds the link consumed or expired", outcome: "blocked" }
    ]
  },
  "captured-otp": {
    title: "Captured OTP",
    family: "Links, codes & recovery",
    summary: "A synthetic manually entered code is disclosed to a lookalike prompt.",
    consequence: "A current code can be relayed because it is not cryptographically bound to the legitimate origin.",
    controls: ["short expiry", "attempt limit", "single use", "transaction context", "WebAuthn for phishing resistance"],
    limitation: "The simulator produces no usable code and performs no relay.",
    steps: [
      { actor: "lookalike prompt", action: "captures a synthetic code label", outcome: "exposed" },
      { actor: "OTP verifier", action: "accepts only a live, unconsumed challenge within its attempt limit", outcome: "observed" },
      { actor: "second use", action: "is rejected by consumption state", outcome: "blocked" }
    ]
  },
  "push-fatigue": {
    title: "Push fatigue",
    family: "Links, codes & recovery",
    summary: "Repeated synthetic approval prompts test whether denial remains safe and understandable.",
    consequence: "A user may approve to stop confusing prompts when the ceremony lacks context or abuse controls.",
    controls: ["number or transaction matching", "prompt rate limit", "clear deny and report", "risk lockout", "phishing-resistant step-up"],
    limitation: "Auth Lab sends no notification and contains no push provider integration.",
    steps: [
      { actor: "scenario engine", action: "shows a fixed repeated-prompt condition", outcome: "observed" },
      { actor: "user", action: "denies and reports the unrecognized request", outcome: "contained" },
      { actor: "policy", action: "suppresses further prompts and requires a safer recovery path", outcome: "blocked" }
    ]
  },
  "recovery-abuse": {
    title: "Recovery abuse",
    family: "Links, codes & recovery",
    summary: "A synthetic recovery request lacks sufficient proof for a high-impact authenticator reset.",
    consequence: "Weak recovery can bypass a strong primary authenticator and become the real account security boundary.",
    controls: ["generic request response", "independent proof", "cooling-off period", "existing-device notice", "session revocation"],
    limitation: "No account is looked up and no recovery message or authenticator change occurs.",
    steps: [
      { actor: "recovery requester", action: "claims loss of every authenticator", outcome: "observed" },
      { actor: "recovery policy", action: "requires independent evidence and a delay", outcome: "blocked" },
      { actor: "account owner", action: "receives a synthetic change notification", outcome: "contained" }
    ]
  },
  "session-fixation": {
    title: "Session fixation",
    family: "Sessions & OAuth",
    summary: "A pre-authentication session identifier is known before the synthetic sign-in boundary.",
    consequence: "Reusing that identifier after authentication could let another holder attach to the signed-in state.",
    controls: ["rotate on authentication", "server-side ownership", "secure cookie flags", "logout and revocation"],
    limitation: "Only opaque labels are compared; no cookie or session token is returned.",
    steps: [
      { actor: "anonymous browser", action: "holds pre-auth session label A", outcome: "exposed" },
      { actor: "authentication service", action: "invalidates A and creates post-auth label B", outcome: "contained" },
      { actor: "holder of A", action: "cannot access B's authenticated state", outcome: "blocked" }
    ]
  },
  "token-expiry-replay-revocation": {
    title: "Token expiry, replay, and revocation",
    family: "Sessions & OAuth",
    summary: "One synthetic access grant is observed across live, expired, replayed, and revoked states.",
    consequence: "A bearer token remains usable by a thief until expiry or effective revocation unless additional proof is required.",
    controls: ["short lifetime", "audience and scope", "replay cache for one-time artifacts", "revocation", "sender constraint"],
    limitation: "No serialized token or authorization header exists in this scenario.",
    steps: [
      { actor: "resource", action: "accepts the correctly scoped live grant label", outcome: "observed" },
      { actor: "resource", action: "rejects the same label after synthetic expiry", outcome: "blocked" },
      { actor: "revocation service", action: "marks remaining active grant state revoked", outcome: "contained" },
      { actor: "replay attempt", action: "is rejected by expiry, revocation, or replay state", outcome: "blocked" }
    ]
  },
  "missing-oauth-state": {
    title: "Missing OAuth state",
    family: "Sessions & OAuth",
    summary: "A callback arrives without correlation to the browser's initiating authorization request.",
    consequence: "Accepting it can bind the wrong authorization response or enable login CSRF-style confusion.",
    controls: ["unpredictable state", "browser transaction binding", "single use", "exact callback validation"],
    limitation: "No redirect occurs; the engine evaluates a fixed malformed callback shape.",
    steps: [
      { actor: "synthetic callback", action: "omits the expected state correlation", outcome: "exposed" },
      { actor: "relying party", action: "fails closed before code exchange or account linking", outcome: "blocked" }
    ]
  },
  "invalid-redirect-uri": {
    title: "Invalid redirect URI",
    family: "Sessions & OAuth",
    summary: "A fixed lookalike callback differs from the client's exactly registered redirect URI.",
    consequence: "Loose redirect matching can deliver authorization artifacts to an unintended endpoint.",
    controls: ["exact pre-registration", "no wildcard matching", "issuer/client binding", "PKCE as an additional boundary"],
    limitation: "The lookalike is a non-routable label; no URL is fetched or followed.",
    steps: [
      { actor: "authorization request", action: "names a fixed mismatched callback label", outcome: "exposed" },
      { actor: "authorization server", action: "compares the complete URI to registration", outcome: "blocked" }
    ]
  },
  "email-only-account-linking": {
    title: "Email-only account linking",
    family: "Sessions & OAuth",
    summary: "A federated identity shares an email string with an existing local account but has no authenticated link ceremony.",
    consequence: "Automatically merging on email can give the wrong provider subject control of an existing account.",
    controls: ["issuer + subject ownership", "authenticated linking", "conflict rejection", "safe unlinking", "notification"],
    limitation: "No identity or account record is read or changed.",
    steps: [
      { actor: "synthetic provider", action: "returns a colliding email label", outcome: "observed" },
      { actor: "account boundary", action: "refuses email-only ownership inference", outcome: "blocked" },
      { actor: "signed-in owner", action: "must explicitly link the provider subject", outcome: "contained" }
    ]
  },
  "phishing-vs-webauthn": {
    title: "Traditional phishing vs WebAuthn",
    family: "Origin & token binding",
    summary: "The same fixed lookalike-origin condition is applied to a typed secret and a WebAuthn ceremony.",
    consequence: "A person can disclose a password or OTP to a convincing origin; an authenticator will not sign for the wrong relying-party origin.",
    controls: ["WebAuthn origin and RP ID binding", "user verification", "recognizable transaction context", "safe recovery"],
    limitation: "No page is cloned, no secret is requested, and no authenticator ceremony is launched.",
    steps: [
      { actor: "typed-secret model", action: "shows why a user could disclose reusable knowledge", outcome: "exposed" },
      { actor: "WebAuthn model", action: "refuses a signature for the fixed lookalike origin", outcome: "blocked" },
      { actor: "verifier", action: "requires the legitimate RP ID and challenge", outcome: "contained" }
    ]
  },
  "bearer-vs-sender-constrained": {
    title: "Bearer theft vs sender constraint",
    family: "Origin & token binding",
    summary: "A copied synthetic grant label is evaluated first as bearer authority and then as key-bound authority.",
    consequence: "Possession is enough for an unexpired bearer token; a sender-constrained token also requires proof from its bound private key.",
    controls: ["DPoP or mTLS", "method and URI binding", "access-token hash", "proof time and identifier", "replay cache"],
    limitation: "No token, key, proof, header, endpoint, or theft technique is exposed.",
    steps: [
      { actor: "bearer resource model", action: "accepts the copied live grant label", outcome: "exposed" },
      { actor: "DPoP resource model", action: "rejects the same label without its bound key proof", outcome: "blocked" },
      { actor: "proof replay model", action: "rejects reuse of the fixed proof identifier", outcome: "contained" }
    ]
  }
};

export function evaluateDefensiveScenario(id: DefensiveScenarioId): DefensiveResult {
  return { ...scenarios[id], executed: false, id, synthetic: true };
}

export const defensiveScenarioCatalog = defensiveScenarioIds.map((id) => ({
  family: scenarios[id].family,
  id,
  title: scenarios[id].title
}));
