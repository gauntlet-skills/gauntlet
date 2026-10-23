# The build sequence

Core and tail are fixed. Only the feature count varies, which is why a typical
app lands around 16 prompts.

## Core (fixed, 1–7)

**1 — Spec validation & project setup.** Produces `CLAUDE.md` and `SPEC.md`.
**No code.** This prompt exists to force the spec to be consistent before
anything is built on it: the routes listed in the file list, the routes in the
routes section, and the routes the auth phase creates must be the same set.

**2a — Project setup.** `package.json` with pinned deps and scripts (including
`check:all`), tsconfig with `strict` and `noUncheckedIndexedAccess`,
`.env.example`, `env.ts` validating at startup, the secret scanner, eslint,
`next.config.ts` with security headers (CSP, HSTS, X-Frame-Options,
X-Content-Type-Options), tailwind, logger, query client.

**2b — Security utilities & API foundation.** Middleware ordered
headers → CSRF → auth. Database clients (browser/server/admin). Rate limiting
that fails closed, plus cost ceilings if anything metered is called. Audit log.
Payment client with the plan constants. AI client **only if the spec has an AI
feature** — absent, not stubbed, if not. Email. The API handler wrapper.
Ownership helpers. Subscription gates. Health route. Shared schemas.

**3 — Database schema.** The shared foundation, and the one prompt that owns it.
Membership/ownership helper as `SECURITY DEFINER STABLE`. Backbone tables plus
the core entity spine — anything two or more features touch. New-user trigger.

> **Schema ownership rule:** a table referenced by ≥2 features belongs to Prompt
> 3. A table used by exactly one feature belongs to that feature's prompt. Never
> define a table twice; never leave a foreign-keyed table with no creating
> migration. This is the rule most worth restating inside the prompt itself.

**4 — Types & validation.** Generated DB types, shared Zod schemas, the shapes
every later prompt imports.

**5 — Design system & UI components.** Tokens from the design direction, base
components, shared primitives. Require an empty state on every list component —
it is the single most-forgotten UI state.

**6 — Authentication.** Email + password through server routes. The route set
must match the SPEC file list exactly. Dual fail-closed rate limits (by IP and
by identifier), lockout with a stated threshold and duration, anti-enumeration
on password reset, enforced email verification, bot protection on signup.

**7 — Layout, navigation & dashboard.** Marketing landing, onboarding, app
shell, and a dashboard that shows something real on first login. Email
templates.

## Features (8 … N, cap 8)

One prompt per MVP feature. Each one creates **only its own** migration, foreign
keyed to Prompt 3's foundation, with row-level security via the shared helper.
Then its schemas, its API routes (auth + ownership + rate limit), and its UI.

Cap at 8. A spec with more than eight MVP features does not have an MVP.

## Tail

**Stripe** — reuses Prompt 3's subscription and webhook-event tables. Raw-body
webhook with signature verification, every event type the flow depends on,
insert-before-process idempotency.

**Legal/GDPR** — privacy policy naming every sub-processor by name, terms with
the caps-convention warranty disclaimer and an AI disclosure if applicable,
cookie consent, a rate-limited export endpoint, account deletion that cascades.

**Polish** — empty states, skeletons, error boundaries reporting to the monitor,
custom 404, responsive down to 768px, toasts, robots.

**Testing & CI/CD** — unit tests for the things that fail silently: rate limits
in *both* directions (allows under the limit, blocks over it), subscription
gates, validation, cross-user isolation. E2E for signup → verify → onboard →
core flow → paywall → payment.

> **CI is a specified deliverable, not a suggestion.** Write the workflow file
> with named jobs — lint, typecheck, secret scan, test, build, e2e — and the
> branch it triggers on. "Add a CI pipeline" is not a build prompt. And check
> the branch name: a workflow watching `main` in a repo whose branch is `master`
> never runs, and an empty run history reads exactly like a passing one.

## Adapting the sequence

Real builds reorder, and that is fine when the reason is written down. One build
moved CI earlier ("was 12; moved up — CI is overdue") and added a preview deploy
at 13 to de-risk infrastructure before the production deploy at 16. Both were
good calls; both were annotated in the plan.

What does not move: Prompt 3 before any feature prompt, 2b before anything that
calls an API, and the tail after the features.
