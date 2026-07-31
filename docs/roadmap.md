# Auth Lab Roadmap

This document is the delivery plan for the [product vision](product-vision.md).
The [README](../README.md) remains the source of truth for what is currently
implemented and how to run it.

Estimates assume one developer working on complete, reviewable vertical slices.
They are planning ranges, not release commitments.

## Learning progression

Auth Lab should tell the story of how authentication evolved, not present a flat
collection of login buttons. The home page will become an **Evolution Map** with
five classifications:

| Classification | Meaning in the lab |
| --- | --- |
| Historical | Important for understanding the past, but not recommended for new systems. |
| Transitional | Still common and sometimes necessary, but has known limitations or a safer successor. |
| Recommended | A standards-backed default for an appropriate 2026 use case. |
| High assurance | Stronger controls for regulated or high-risk contexts, with additional cost and complexity. |
| Emerging | Promising technology or an unfinished standard; educational and experimental, not a production recommendation. |

These classifications are contextual. A method is not “secure” in isolation:
recovery, enrollment, implementation, user population, threat model, and
operational controls all affect the result.

The map will support five parallel learning tracks so that unlike concepts are
not ranked as if they were substitutes:

1. **Human authentication and MFA** — passwords, OTP, passkeys, security keys,
   recovery, and step-up authentication.
2. **Federation and delegated authorization** — SAML, OpenID Connect, OAuth,
   provider login, and consent.
3. **Sessions and tokens** — server sessions, cookies, JWTs, rotation,
   revocation, and sender-constrained tokens.
4. **Special environments** — constrained-device authorization and managed,
   high-assurance client credentials.
5. **Machine and workload identity** — API keys, service accounts, client
   credentials, certificates, and workload identity.

Each method page will show **Then / Now / Next**: what problem the method solved,
why it remains or was replaced, and what a new system should normally consider
today. The catalog will expose separate labels for implementation state
(`Interactive`, `Simulation`, or `Coming later`) and recommendation
classification; “implemented” must never be mistaken for “recommended.”

Comparisons will first use observable properties—phishing resistance, replay
resistance, verifier breach impact, recovery risk, hardware or provider
dependency, accessibility, and operational cost. An S–D tier list may summarize
those trade-offs only when it declares its scenario and evidence date; it is
never a universal security score. Different learning tracks have separate tier
lists.

## Delivery sequence

### Milestone 0 — Password baseline

**Status:** Interactive

The current email/password vertical slice is the starting point of the story. It
already includes registration, verification, sign-in, recovery, database-backed
sessions, sanitized recorded flows, and the five educational panels. Current
capabilities and commands are documented in the [README](../README.md).

### Milestone 1 — Evolution map and 2026 password guidance

**Status:** Interactive

Completed on 2026-07-26. The Evolution Map, safe historical exhibits, typed
evidence and narratives, updated password policy, local blocklist, and visible
online-guessing defenses are documented in the [README](../README.md).

**Estimate:** 1–2 days

- Replace the flat catalog presentation with the Evolution Map, track filters,
  classification legend, and a visible journey from historical to emerging.
- Add the `Then / Now / Next` narrative and evidence links to method metadata.
- Add safe, non-interactive exhibits for security questions, server-verified
  PINs, and arbitrary password composition/rotation policies, explaining why
  they should not be copied.
- Align the password lab with current NIST guidance: 15-character minimum for a
  password used as a single factor, support at least 64 characters, use a
  compromised/common-password blocklist, avoid arbitrary composition rules, and
  do not require periodic changes without evidence of compromise.
- Demonstrate rate limiting and online guessing defenses without providing an
  offensive tool.
- Keep the security classification contextual and show that passwords are not
  phishing-resistant.

**Done when:**

- A visitor can understand the recommended learning order before opening a lab.
- Historical exhibits are visibly non-recommended and cannot collect real
  credentials.
- Catalog navigation, explanations, comparisons, and status labels still come
  from one typed source of truth.
- The updated password policy is covered by unit, integration, and E2E tests.

### Milestone 2 — Scalable feature structure

**Status:** Complete

Completed on 2026-07-26. Feature adapters, shared contracts, five composed
password panels with a controller hook, separated persistence schemas, and
authentication/recorder/session service boundaries are documented in the
[README](../README.md).

**Estimate:** 1–2 days

Prepare the implementation boundary before adding another working method:

- Organize product code into feature modules and server code into service
  boundaries.
- Split the password lab into five panel components and a controller hook.
- Extract shared flow, event, session, method, evidence, and classification
  contracts.
- Separate authentication-library and educational-recorder schemas.
- Define a method adapter used by the catalog, recorder, panels, and tests.

**Done when:**

- No authentication behavior or public route changes.
- Password-specific logic no longer lives in shared catalog or recorder code.
- Existing checks pass, and a new method can supply its metadata and panels
  without modifying the password implementation.

### Milestone 3 — Link and code authentication

**Status:** Complete

Completed on 2026-07-26. Magic link, email OTP, authenticator-app TOTP, encrypted
recovery codes, step-up, removal, replay handling, and the labelled local SMS
simulation are documented in the [README](../README.md).

**Estimate:** 3–5 days

Build the transitional passwordless and possession-factor chapter:

- Email magic link with single use, expiry, replay handling, and Mailpit delivery.
- Email OTP as passwordless authentication.
- TOTP as an additional factor, including enrollment, confirmation, recovery
  codes, removal, and step-up.
- SMS OTP as a clearly labelled local simulation, including number-recycling,
  interception, delivery, and cost trade-offs.
- Demonstrate why manually entered links and codes remain phishable and why
  adding a PIN to a password is not a second factor.

### Milestone 4 — Passkeys and phishing-resistant authentication

**Status:** Complete

Completed on 2026-07-26. Discoverable platform and roaming credentials,
mandatory user verification, exact origin and relying-party binding, public-key
storage, authenticated linking and revocation, recovery trade-offs,
downgrade-resistant failure handling, and roaming security-key step-up are
documented in the [README](../README.md).

**Estimate:** 3–5 days

Build the recommended 2026 destination for broadly applicable consumer and
workforce authentication:

- WebAuthn registration and authentication with platform and roaming
  authenticators.
- Discoverable credentials/passkeys, user verification, origin binding, and
  public-key storage.
- Account bootstrap and linking between password and passkey credentials.
- Synced-passkey, device-bound-key, shared-device, and lost-device recovery
  trade-offs.
- Invalid origin, challenge expiry, replay, and downgrade cases.
- Security-key step-up for users or operations requiring stronger assurance.

Passkeys will be presented as a recommended default when the product ecosystem
supports them and has a safe recovery strategy—not as a universal mandate.

### Milestone 5 — Federation evolution

**Status:** Complete

Completed on 2026-07-26. Local OpenID Connect Authorization Code with PKCE,
discovery, consent, signed ID-token validation, account lifecycle and conflict
handling, encrypted provider tokens, five educational views, and the safe SAML
enterprise simulation are documented in the [README](../README.md).

**Estimate:** 1–2 weeks

- Explain the path from local credentials and SAML to modern OpenID Connect.
- Implement OpenID Connect Authorization Code with PKCE using a local provider
  first. Google, GitHub, Microsoft, or Apple remain optional operator adapters
  because they require external credentials and provider-specific review.
- Visualize redirect, `state`, `nonce`, PKCE, callback, token exchange, consent,
  and local session creation.
- Implement account linking, conflicting identities, provider unlinking, and
  safe provider-token handling.
- Keep OAuth authorization distinct from OpenID Connect authentication.
- Add SAML as a local enterprise demonstration after the federation adapter is
  proven.

### Milestone 6 — Sessions, tokens, and step-up

**Status:** Complete

Completed on 2026-07-31. The dedicated sessions and tokens lab, visible cookie
and server-session lifecycle, owned concurrent-session controls,
risk-triggered security-key step-up, persisted recent assurance, contextual
JWT/access/refresh-token comparison, and real local DPoP proof-of-possession
flow are documented in the [README](../README.md).

**Estimate:** 4–7 days

- Compare opaque database sessions, cookies, access tokens, refresh tokens, and
  JWTs without treating JWT as a login method.
- Demonstrate cookie flags, fixation prevention, rotation, expiry, logout,
  revocation, and concurrent-session controls.
- Add risk-triggered and standards-based step-up authentication.
- Demonstrate sender-constrained access tokens with DPoP and explain when mTLS is
  the more appropriate high-assurance choice.

### Milestone 7 — Enterprise and high assurance

**Status:** Planned

**Estimate:** 1–2 weeks

- Enterprise OpenID Connect and SAML SSO.
- Device Authorization Grant and QR-assisted login for constrained devices.
- FAPI 2.0 security-profile concepts, private-key clients, mTLS, and certificate
  lifecycle.
- Smartcard and enterprise-directory concepts through local providers or
  clearly labelled simulations.
- Provisioning and organization administration remain outside scope until the
  authentication journeys are complete.

### Milestone 8 — Machine and workload identity

**Status:** Planned

**Estimate:** 1–2 weeks

Show the evolution independently from human login:

- Long-lived API keys and personal access tokens as the baseline to improve.
- Scoped service accounts and OAuth Client Credentials.
- Signed client assertions, secret rotation, certificates, and
  sender-constrained credentials.
- Short-lived workload identity and federation as the recommended direction
  where the deployment platform supports it.
- Separate machine principals, audiences, scopes, rotation, expiry, audit, and
  revocation from user sessions.

### Milestone 9 — Portable and future identity

**Status:** Planned

**Estimate:** 1–2 weeks

- OpenID for Verifiable Presentations and selectively disclosed credentials.
- Wallet trust, issuer/verifier roles, audience and nonce binding, consent,
  correlation, replay, and revocation trade-offs.
- Agent authorization and delegated AI actions only as an **Emerging** exhibit
  while the relevant profiles remain drafts.
- Clearly distinguish a final standard, a draft, and a product experiment in
  both the UI and source metadata.

### Milestone 10 — Defensive attack simulator

**Status:** Planned; grows alongside milestones 3–9

**Estimate:** 1–2 weeks of cumulative work

Build a local-only simulator using synthetic identities and controlled services:

- Reused passwords and simulated credential stuffing.
- Captured links and OTPs, push fatigue, and recovery abuse.
- Session fixation, token theft, expiry, replay, and revocation.
- Missing OAuth `state`, invalid redirect URIs, and account-linking mistakes.
- Traditional phishing compared with WebAuthn origin binding.
- Bearer-token theft compared with sender-constrained tokens.

It must explain protections and consequences without becoming an operational
attack toolkit.

## Release rule for every interactive method

An interactive method is complete only when it:

- implements the full enrollment/authentication/recovery or revocation journey;
- supplies all five views defined in the [product vision](product-vision.md);
- records only sanitized, owned events and never exposes secrets;
- includes success, failure, replay/expiry, recovery, and ownership tests;
- works with keyboard navigation on desktop and mobile; and
- states its classification, evidence date, use cases, limitations, and safer
  successor where one exists.

Completed behavior moves to the README; planned behavior remains here.

## Standards baseline

The classifications should be reviewed at least once per year and whenever a
cited standard changes:

- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)
  defines the current password, authenticator-assurance, replay-resistance, and
  phishing-resistance guidance used by the human-authentication track.
- [W3C WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/) defines the
  public-key credential model behind passkeys and security keys.
- [OAuth 2.0 Security Best Current Practice, RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700)
  informs the modern federation and authorization examples.
- [OAuth 2.0 Demonstrating Proof of Possession, RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449)
  defines DPoP sender-constrained tokens.
- [FAPI 2.0 Security Profile](https://openid.net/specs/fapi-security-profile-2_0.html)
  informs high-assurance authorization scenarios.
- [OpenID for Verifiable Presentations 1.0](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
  anchors the portable-identity chapter.
- [IETF OAuth Working Group documents](https://datatracker.ietf.org/wg/oauth/documents/)
  are used to track emerging work; Internet-Drafts remain explicitly
  experimental in the lab.
