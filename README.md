# Auth Lab

This README documents the current implementation, local operation, and test
commands. Read the [product vision](docs/product-vision.md) for the rationale and
conceptual model, and the [roadmap](docs/roadmap.md) for planned delivery.

## What is implemented

- Registration with a 15–128 character password, Unicode and password-manager
  support, and common/compromised/context-specific password screening
- Mandatory email verification
- Explicit sign-in and database-backed cookie sessions
- Always-on client throttling for sign-in and reset requests
- Session inspection and revocation without returning session tokens
- Generic duplicate-account and reset-request behavior
- Password reset with existing-session revocation
- Mailpit verification and reset emails
- Visitor/user-owned authentication flow history
- Ordered flow diagram and sanitized network inspector
- Evolution Map with track filters, contextual recommendation classifications,
  safe historical exhibits, and `Then / Now / Next` evidence
- Complete contextual comparison and track-specific 2026 tier lists covering
  every catalog method
- Feature adapters and shared method, flow, event, session, evidence, and
  classification contracts for adding methods without coupling them to the
  password implementation
- Five independently composed password panels coordinated by one controller
  hook, with authentication, recorder, and session service boundaries
- Separate Better Auth and educational-recorder database schemas
- Five-minute, atomically single-use magic-link authentication through Mailpit
- Six-digit email OTP with hashed storage, rotation, expiry, attempt limits,
  session creation, and replay rejection
- TOTP enrollment with QR transfer, confirmation, required password step-up,
  replay defense, account lockout, encrypted recovery codes, and removal
- A clearly labelled local SMS OTP simulation covering interception,
  number-recycling, expiry, attempts, consumption, replay, delivery, and cost
- WebAuthn registration and discoverable passkey authentication with platform
  and roaming authenticators, mandatory local user verification, exact origin
  and relying-party binding, five-minute single-use challenges, and public-key
  storage
- Authenticated passkey linking, credential inventory and revocation, explicit
  synced versus device-bound recovery guidance, downgrade-resistant failures,
  and roaming security-key step-up that does not create another session
- OpenID Connect Authorization Code with S256 PKCE against a synthetic local
  provider, including discovery, consent, exact callback and issuer checks,
  signed and expiring nonce-bound ID tokens, one-minute single-use codes, and
  encrypted provider-token storage
- Federated sign-up and sign-in, explicit account linking, conflicting-email
  rejection, provider-subject ownership, safe unlinking, and local-session
  creation without treating OAuth authorization as authentication
- A clearly labelled SAML enterprise SSO simulation covering issuer metadata,
  signatures, request correlation, audience, destination, time windows,
  replay, certificate rollover, and account-linking boundaries without
  accepting executable XML or creating a session

Password hashes, submitted passwords, verification/reset tokens, raw cookies,
authorization headers, and arbitrary request bodies are never accepted by the
recorder.

## Start the complete environment

Requirements: Docker with Compose support.

```bash
docker compose up --build
```

Then open:

- Auth Lab: <http://localhost:3000>
- Mailpit inbox: <http://localhost:8025>
- PostgreSQL: `localhost:5433` (database/user/password: `authlab`)

The app container waits for PostgreSQL, applies committed Drizzle migrations,
and then starts Next.js.

To remove containers and the persistent database volume:

```bash
docker compose down --volumes
```

## Local hybrid development

Start PostgreSQL and Mailpit with Docker, copy the environment file, and run
Next.js with npm:

```bash
docker compose up postgres mailpit
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

When Next.js runs on the host, change `DATABASE_URL` to use `localhost` and
`SMTP_HOST` to `localhost`.

Useful commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:reset
npm run typecheck
npm run lint
npm run test:run
npm run build
```

`db:seed` creates `demo@auth-lab.local` with password
`correct horse battery staple`; verify it through Mailpit before signing in.
The local OpenID Provider offers two independent synthetic identities and this
same demo email as an intentional conflict case. It never asks for or stores a
real external-provider credential.
`db:reset` deletes all Auth Lab records while retaining the schema.

## Tests

Unit tests need no external services:

```bash
npm run test:run
```

Recorder integration tests run when an isolated, already-migrated PostgreSQL
database is provided:

```bash
TEST_DATABASE_URL=postgresql://authlab:authlab@localhost:5433/authlab npm run test:run
```

For browser tests, start the Compose environment first:

```bash
npx playwright install chromium
npm run test:e2e
```

Override `PLAYWRIGHT_BASE_URL` or `MAILPIT_API_URL` when the services are not on
their default local ports.

The OIDC lifecycle E2E test runs on desktop and mobile projects and traverses
the actual relying-party → provider → callback redirects. The local provider
uses a development-only symmetric ID-token signature because both roles live
inside one process. A real external adapter should use provider discovery and
asymmetric signature verification; never reuse the local signing arrangement.

## Architecture

- `src/lib/catalog.ts` assembles the typed source of truth for method metadata,
  classification, learning track, evolution narrative, evidence, comparison
  ratings, tier grade, and rationale. Interactive entries come from registered
  feature adapters; the map, comparison, and tier views consume the same
  collection.
- `src/features/method-registry.ts` registers interactive method adapters.
  `src/features/password/adapter.ts` owns password metadata, panel definitions,
  recorder journeys, and safe client-event templates.
- `src/contracts` contains the method-independent contracts consumed by product
  features, persistence, panels, and tests.
- `src/features/password/components` contains the five password lab panels and
  flow history; `use-password-lab-controller.ts` owns their shared behavior.
- `src/services` contains authentication, recorder, and session server
  boundaries. Compatibility exports in `src/lib` preserve existing imports.
- `src/db/schema/auth.ts` and `src/db/schema/recorder.ts` keep authentication
  library persistence separate from educational flow persistence while
  retaining the committed database schema.
- `src/features/link-code` contains the Milestone 3 adapters, real link/code
  labs, TOTP ceremony, SMS simulator, and replay-defense boundaries.
- `src/features/passkey` contains the passkey adapter, real WebAuthn lab,
  relying-party policy, and session-bound security-key step-up ceremony.
- `src/features/federation` contains the OIDC and SAML adapters, protocol
  primitives, local-provider boundary, five educational views, explicit
  linking/unlinking policy, and safe conflict demonstrations.
- `drizzle/0004_shiny_christian_walker.sql` adds atomically consumable,
  one-minute authorization codes bound to the client, redirect URI, nonce,
  subject, and S256 PKCE challenge.
- `drizzle/0003_easy_gressill.sql` adds public-key credential storage,
  passkey/security-key assurance labels, and atomically consumable WebAuthn
  step-up challenges. Magic-link, email-OTP, and ordinary passkey challenges
  reuse Better Auth's verification store.
- `src/services/auth/service.ts` configures Better Auth, local OIDC federation,
  encrypted OAuth-token storage, deliberate account linking, email delivery,
  session policy, database hooks, prospective-password screening, and endpoint
  rate limits.
- `src/features/password/server/credentials.ts` owns the NIST-aligned length
  boundary and the auditable local password blocklist. A production deployment
  should replace the demonstrative corpus with a substantially larger,
  maintained source and distributed, account-aware abuse controls.
- `src/lib/recorder.ts` owns ordered event persistence and ownership checks.
- `src/lib/safe-metadata.ts` is the recorder's strict metadata boundary.
- `src/app/api/lab` exposes owned flow history and token-free session summaries.
- `src/components/password-lab.tsx` synchronizes the five educational panels.
