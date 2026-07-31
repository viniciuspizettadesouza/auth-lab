# Auth Lab Product Vision

## Purpose

Auth Lab is an interactive authentication museum: a place where developers can
run authentication flows and observe what happens behind the interface.

The project is not intended to be another page containing several login
buttons. Each method should combine a working user journey with an educational,
sanitized view of its actors, requests, state transitions, storage, session
behavior, recovery model, and security trade-offs.

## Concepts

Auth Lab treats these as distinct concerns:

| Concern | Question |
| --- | --- |
| Authentication | Who is the user? |
| MFA | What additional proof did the user present? |
| Federation | Did another system confirm the identity? |
| Session | How does the application preserve authenticated state? |
| Machine authentication | How does a non-human workload prove its identity? |

OAuth 2.0 is primarily an authorization framework. Authentication through an
OAuth-style redirect normally relies on OpenID Connect or provider-specific
identity APIs. The laboratory should make that distinction visible instead of
using “OAuth” as a generic synonym for login.

## Experience for each method

Every interactive method should eventually provide the same five views:

1. **User experience** — a real form, redirect, prompt, device action, or key
   ceremony.
2. **Flow** — an ordered diagram of the user, browser, application, identity
   provider, database, and other participating actors.
3. **Network inspector** — a safe projection of endpoints, field names,
   responses, timing, and relevant protocol properties.
4. **Explanation** — what is provided, stored, and verified; how recovery works;
   and what the operational and security risks are.
5. **Comparison** — observable trade-offs remain primary. A tier may summarize
   them only for a declared scenario, evidence date, and comparable track; it is
   never a universal security score.

## Delivery

The ordered method collection, architectural preparation, completion criteria,
and Attack Simulator scope are maintained in the [roadmap](roadmap.md).

## Product principles

- Real behavior is preferred when it can run safely in a local sandbox.
- Simulated steps must be clearly identified as simulations.
- Security classifications are contextual and educational, not guarantees.
- Secrets are never teaching props.
- Authentication, federation, authorization, and session management remain
  explicitly separated.
- Each new method must be complete enough to compare, inspect, recover, and test.
- Features grow as complete vertical slices rather than partially implemented
  integrations.
- Defensive demonstrations expose consequences and controls through fixed
  synthetic models; they never accept operational attack targets or payloads.
- External evidence follows the [reference policy](references.md): publication
  status and supported claims remain explicit, and project judgments are not
  attributed to standards bodies.
