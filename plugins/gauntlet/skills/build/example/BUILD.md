# WalkLog — Build Document

A worked example. Deliberately small: one feature, one paid tier. Real build docs
have more feature phases (cap 8) but the same shape throughout.

**Read this before writing your own.** It is the shape `lint-buildplan.mjs`
checks for — every prompt fenced, every checkpoint after the fence with 5–10
verifiable items, no pasted implementations.

---

## App Specification

**WalkLog** — dog walkers log walks and send clients a weekly photo summary.

**Target user:** independent dog walkers with 5–30 regular clients. Not technical.
Phone-first.

**What a user can do:** add clients · log a walk (duration, notes, up to 3 photos)
· see the week per client · send a weekly summary email.

**Tech stack (pinned):** Next.js 15.5.x · TypeScript 5.7 · Supabase (Postgres +
Auth + Storage) · Stripe · Tailwind + shadcn/ui · Upstash Redis · Resend ·
Sentry · Vercel.

**Account types:** one (walker). No admin UI; admin by env-var user id list.

**Tiers:** Free — 3 clients, no email summaries. Pro $12/mo — unlimited clients,
weekly summaries, photo storage.

**No AI.** Nothing in this product needs a model, so no AI client, no `AI_MODEL`
env var, and no AI-security scaffolding is generated. Absent, not stubbed.

**Env vars —** REQUIRED: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_APP_URL`. FEATURE: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_PRO`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`. OPTIONAL: `SENTRY_DSN`.

## Standing rules

The 16 Phase-Zero non-negotiables apply to every file and go into `CLAUDE.md`.
See `reference/standing-rules.md`. The ones this app leans on hardest: secrets in
env only (1), env validated at startup (2), RLS on every table and bucket (3),
generic client errors (5), auth checked first on every route (6), Zod on every
input (7), webhook idempotency (8), no placeholder code (9), CSRF (10).

---

## Prompt 1 — Spec validation & project setup

```
Read the App Specification above in full. Do not write application code in this
prompt.

1. Confirm the spec is complete enough to build a production SaaS that can safely
   take payments. Flag anything missing across security, scalability, legal, and
   compliance as a markdown table with columns: Gap, Why it matters, Suggested
   resolution.

2. Produce a FILE LIST for the whole build, grouped by the prompt that creates
   each file. It must include: the security utilities (rate limiting, ownership,
   API handler), every auth route, the walks and clients modules, the Stripe
   routes, and the legal pages. State the exact route paths for auth — they must
   match what Prompt 6 creates, byte for byte.

3. Write CLAUDE.md as a committed file. It contains the 16 standing rules, the
   pinned stack table, the schema-ownership rule (a table used by two or more
   features belongs to Prompt 3; a table used by one belongs to that feature's
   prompt), and this app's specifics: one account type, two tiers with the exact
   limits above, no AI anywhere.

4. Write SPEC.md as a committed file: the App Specification above, expanded with
   the data model (clients, walks, walk_photos), the route list, and the tier
   limits as a single PLANS table that every later prompt references rather than
   restating.

5. In SPEC.md, state the password policy once — minimum 12 characters with upper,
   lower, number and symbol — and note that the Zod schema, the auth routes, the
   signup and reset UI copy, and CLAUDE.md all use that exact number. Two places
   that restate a policy eventually disagree, and the disagreement surfaces as a
   user who cannot sign up.

6. List the storage buckets this app needs (one: walk-photos, private) and note
   that buckets carry their own policies separate from table RLS.

End with: "Spec validated. N gaps flagged. CLAUDE.md and SPEC.md written."
```

### Checkpoint 1

- [ ] `CLAUDE.md` and `SPEC.md` exist and are committed
- [ ] The file list names all six auth routes, and they match SPEC.md exactly
- [ ] Tier limits appear exactly once, in SPEC.md's PLANS table
- [ ] CLAUDE.md states "no AI" explicitly
- [ ] Gap table has at least one row (a spec with zero gaps was not read carefully)
- [ ] No `.ts` or `.tsx` files were created

---

## Prompt 2a — Project setup

```
Create the project skeleton. Name each file and its key requirements; do not
write feature code.

1. `package.json` — Next.js 15.5.x, TypeScript 5.7, and the pinned stack above.
   Scripts: dev, build, lint, typecheck, test, env:validate, check:secrets, and
   check:all running typecheck → lint → test → build → check:secrets in that
   order. check:secrets runs last because it scans build output.

2. `tsconfig.json` — strict, noUncheckedIndexedAccess, path alias `@/*`.

3. `.env.example` — every var from the spec, bucketed REQUIRED / FEATURE /
   OPTIONAL, placeholder values only.

4. `src/lib/env.ts` — Zod schemas for server and client vars, validated at module
   load so the app crashes on a missing var rather than at first request. Export
   serverEnv and clientEnv. Nothing else reads process.env.

5. `scripts/check-secrets.mjs` — scan the built client bundle for secret-shaped
   strings (Stripe sk_/rk_, whsec_, Resend re_). Exit 1 on a find. Exit 2 — not 0
   — if the build output directory is absent or empty: "did not run" must never
   report as "clean".

6. `next.config.ts` — Sentry wrapper; security headers CSP, HSTS,
   X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy;
   poweredByHeader: false; 'unsafe-eval' in script-src only when
   NODE_ENV !== 'production'; Access-Control-Allow-Origin pinned to the app's own
   origin plus Vary: Origin.

7. `tailwind.config.ts`, `src/lib/logger.ts` (redacts secret-shaped values), and
   the react-query provider.

8. `.gitignore` covering .env*, .next, node_modules, and any local Supabase
   artifacts. Verify .env.local is ignored before the first commit — a key
   committed once stays in git history even after deletion.

9. `src/lib/constants.ts` — nothing app-specific yet, but establish it as the
   single home for shared literals so later prompts have an obvious place to put
   values rather than duplicating them across modules.
```

### Checkpoint 2a

- [ ] `npm run typecheck` exits 0
- [ ] Deleting a required var from `.env.local` makes `npm run env:validate` fail
- [ ] `npm run check:secrets` exits 2 before any build has run
- [ ] After `npm run build`, `check:secrets` exits 0 and reports a file count
- [ ] `grep -rn "process.env" src/ --include=*.ts | grep -v env.ts` returns nothing
- [ ] `.env.local` is git-ignored

---

## Prompt 2b — Security utilities & API foundation

```
Create the shared security layer every later prompt depends on.

1. `src/middleware.ts` — ordered: security headers, then CSRF Origin check, then
   auth refresh. CSRF rejects POST/PUT/PATCH/DELETE whose Origin is missing, null,
   or not NEXT_PUBLIC_APP_URL, with 403. The Stripe webhook path is exempt because
   it verifies a signature instead.

2. `src/lib/supabase/{client,server,admin}.ts` — browser, server (cookie-bound),
   and service-role clients. The admin client imports 'server-only'.

3. `src/lib/rate-limit.ts` — Upstash-backed. checkAPIRateLimit may fail open.
   checkAuthRateLimitByIP and checkAuthRateLimitByEmail must FAIL CLOSED: if Redis
   errors, return blocked. These are distinct exported functions.

4. `src/lib/api-handler.ts` — withErrorHandling wrapper ordering: body-size limit,
   content-type check, auth, rate limit, then the handler in a try/catch. Returns
   generic messages to the client and sends detail to Sentry. An OwnershipError
   becomes 404, never 403. A 429 carries Retry-After and X-RateLimit-* — except on
   auth routes, which return a bare 429 so per-key reset windows cannot be used to
   enumerate accounts.

5. `src/lib/ownership.ts` — assertOwns(userId, table, id), throwing OwnershipError.

6. `src/lib/subscription.ts` — reads the PLANS constant from SPEC.md; exports
   canAddClient(userId) and canSendSummary(userId).

7. `src/lib/stripe.ts` — the Stripe client and the PLANS constant. Limits live
   here and nowhere else.

8. `src/lib/email.ts` — Resend wrapper.

9. `src/app/api/health/route.ts` — public, no auth, returns 200 and no-store.
   It must not touch the database, so it stays up when the database does not and
   tells you which of the two is broken.

10. `src/lib/audit.ts` — append-only writes to audit_log for signup, login,
    login_failed, password_change, subscription_change and account_delete. Never
    log a password, a token, or a full email in the detail field.

Do NOT create an AI client, an AI_MODEL env var, or any AI scaffolding. This app
has no AI feature. If a later prompt seems to need one, stop and ask rather than
adding it.
```

### Checkpoint 2b

- [ ] A POST with no Origin header returns 403
- [ ] With Upstash env vars pointed at an unreachable host, a login attempt returns 429
- [ ] The same condition on a general API route does not return 429
- [ ] Requesting another user's row by id returns 404, not 403
- [ ] `grep -ril "AI_MODEL\|anthropic\|openai" src/` returns nothing
- [ ] `GET /api/health` returns 200 while signed out
- [ ] `npm run typecheck` exits 0

---

## Prompt 3 — Database schema

```
One migration, `supabase/migrations/001_initial.sql`, containing the shared
foundation only.

1. ENUMs: subscription_tier (free, pro), subscription_status (trialing, active,
   past_due, canceled, expired).

2. A SECURITY DEFINER STABLE helper `owns_client(p_client_id uuid)` returning
   boolean, with SET search_path = public. Every client-scoped policy calls it.
   Do not inline an EXISTS subquery in a policy — it recurses (42P17).

3. Backbone tables, RLS enabled on each, every user_id REFERENCES auth.users ON
   DELETE CASCADE: profiles, subscriptions, webhook_events (stripe_event_id
   UNIQUE), audit_log, login_attempts.

4. The core entity spine — tables more than one feature touches: clients
   (user_id, name, email, created_at) and walks (client_id FK clients, user_id,
   walked_at, duration_min, notes).

5. Do NOT create walk_photos here. It belongs to Prompt 8, the feature that owns
   it.

6. Policies: clients and walks are user-scoped via owns_client or user_id =
   auth.uid(). webhook_events and login_attempts are service-role only —
   USING (false). audit_log is SELECT for the owning user, INSERT service-role
   only.

7. A `handle_new_user` trigger that atomically creates the profile and a trialing
   subscription. SET search_path = public, or it works in the SQL editor and 500s
   under the auth service.

8. Indexes on every foreign key and on walks(walked_at, user_id) — the weekly
   summary query filters on both and will table-scan without it once a walker has
   a few hundred walks.

9. A storage bucket `walk-photos`, private, with policies scoped the same way as
   the tables. Create it through the dashboard or the storage API, not a raw SQL
   INSERT into storage.buckets — a direct insert half-registers the bucket and it
   fails later in ways that look like a permissions bug.

No SELECT * anywhere, in this migration or in any query a later prompt writes
against these tables.
```

### Checkpoint 3

- [ ] Every table in the migration has `enable row level security`
- [ ] `owns_client` exists and declares `SET search_path = public`
- [ ] No policy contains a raw `EXISTS (SELECT`
- [ ] Signing up creates exactly one profile row and one subscription row
- [ ] Deleting a user from auth.users removes their clients and walks
- [ ] Querying another user's client by uuid as an authenticated user returns 0 rows
- [ ] `walk_photos` does not appear in this migration

---

## How this continues

The real document continues through prompts 4–7 (types, design system, auth,
layout), then one prompt per feature from 8, then the tail: Stripe, legal, polish,
testing and CI. The shape never changes — instruction in the fence, checkpoint
after it.

Two things this example shows that are easy to miss:

**The checkpoint items assert behaviour, not existence.** "Deleting a var makes
env:validate fail" is checkable and can fail. "env.ts exists" cannot — the agent
just wrote it.

**Decisions are stated once and referenced after.** Tier limits live in PLANS.
Auth route paths live in SPEC.md. Every later prompt points at them rather than
restating, because two prompts that restate the same value eventually disagree.

## Service keys, by the prompt that first needs them

| Service | First needed | Placeholder OK? |
|---|---|---|
| Supabase (url, anon, service-role) | 3 | No — needed to apply the migration |
| Upstash Redis | 2b | No — fail-closed limits need a live instance |
| Resend | 6 | Yes until verification email is tested |
| Stripe (secret, webhook secret, price id) | Tail — Stripe | No |
| Sentry DSN | 2a | Yes — inert with a placeholder |
| Vercel | Tail — deploy | No |

## Next

When the last checkpoint passes, hand off to **`gauntlet:harden`** for the A–G
cascade. Do not inline hardening here — it is a separate discipline with its own
gates.
