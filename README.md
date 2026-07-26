# Auth Lab

This README documents the current implementation, local operation, and test
commands. For the product rationale, conceptual model, and future roadmap, read
the [product vision](docs/product-vision.md).

## What is implemented

- Registration with a 12–128 character password
- Mandatory email verification
- Explicit sign-in and database-backed cookie sessions
- Session inspection and revocation without returning session tokens
- Generic duplicate-account and reset-request behavior
- Password reset with existing-session revocation
- Mailpit verification and reset emails
- Visitor/user-owned authentication flow history
- Ordered flow diagram and sanitized network inspector
- Educational catalog and contextual method comparison

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

## Architecture

- `src/lib/auth.ts` configures Better Auth, email delivery, session policy, and
  database hooks.
- `src/lib/recorder.ts` owns ordered event persistence and ownership checks.
- `src/lib/safe-metadata.ts` is the recorder's strict metadata boundary.
- `src/app/api/lab` exposes owned flow history and token-free session summaries.
- `src/components/password-lab.tsx` synchronizes the five educational panels.
