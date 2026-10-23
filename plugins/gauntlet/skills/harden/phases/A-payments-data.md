# Phase A — Money and data

Does money move correctly, and can users only reach their own data? Runs before
the broad security sweep because these two are where a mistake is unrecoverable:
a refund is expensive, a leak is permanent.

Steps: **A1** payments · **A2** data access · **A3** env/secrets · **A4** ASO

## A1 — Payments audit

**N/A if the project takes no money.** Record that; don't leave it blank.

Read the actual integration code, not the spec.

- **Webhook signature verified** before any processing. Raw body via
  `request.text()` — `request.json()` breaks signature verification.
- **Idempotency on writes.** Both directions: an idempotency key on outbound
  charge/checkout calls, and a `webhook_events` claim on inbound. Check the claim
  is an *atomic insert*, not read-then-process — that gap is a real finding
  from a real run, and it is wide under retry storms.
- **Out-of-order delivery.** Webhooks arrive out of order. Is there a watermark
  or version guard, and does the happy path also honour it? In one real run
  the checkout-completed handler skipped the guard the other handlers used.
- **Every event type the flow depends on is handled** — checkout completed,
  subscription created/updated/deleted, payment failed, invoice paid.
- **Multiple providers writing one row.** Stripe + a mobile IAP provider sharing
  a profile row and one watermark will clobber each other. Needs a
  `billing_provider` discriminator and reconciliation.
- **Subscription state comes from webhooks only**, never from client input.
- **Limits enforced server-side before the work happens**, not after.
- **Test-card matrix actually run**, or recorded as NOT RUN. Do not imply
  coverage you don't have.

## A2 — Data access audit

The question is not "is there RLS" but "can user X reach user Y's row."

- **RLS enabled on every table.** Count them: N of N, not "yes."
- **Ownership derives from the session**, never from a request-supplied id.
  Enumerate every route that accepts an id and confirm it re-derives ownership.
- **Cross-table policies use `SECURITY DEFINER STABLE` helpers.** A raw `EXISTS`
  subquery against another RLS-protected table recurses — Postgres 42P17.
- **Service-role key confined to server-side admin paths.** Never in a client
  component, never in anything with `NEXT_PUBLIC_`.
- **Storage buckets have policies too.** Buckets are a separate surface from
  tables and are routinely missed.
- **Cascade behaviour on delete.** Every ownership FK wants `ON DELETE CASCADE`
  or account deletion hits a foreign-key RESTRICT.

## A3 — Env and secrets audit

- **Secret scanner exists, and has been proven to fail.** This is the step where
  one project's scanner was found to have never run. See `gates/GATES.md`.
- **All env access goes through a validated module** (Zod at startup), not bare
  `process.env` reads scattered through the codebase.
- **`.env*` in `.gitignore`**, and check git *history*, not just the working tree.
- **Dev/prod separation** — separate database, separate keys, and a startup guard
  that refuses to boot production on test credentials (`sk_test_`, localhost URL,
  a bypass flag).
- **Sensitive values on the host are write-only.** Once set in Vercel they cannot
  be read back; if the original wasn't saved to a password manager it is gone.
- **Anything a CLI printed unmasked is compromised.** Rotate it. The Supabase CLI
  prints legacy JWT keys in the clear without `--reveal`.

## A4 — ASO

**N/A for web-only projects.** Store listing, keywords, screenshots. Only
meaningful alongside Phase F.

## Gate

Mechanical: `gates/run-gate.sh`.

Judgment — Phase A does not pass until:

- [ ] A1 done or recorded N/A with a reason
- [ ] A2 states RLS coverage as N of N, and names the routes that accept an id
- [ ] A3's secret scanner has been **canary-verified** this run — planted, seen red
- [ ] Zero CRITICAL, zero HIGH open
- [ ] Every "What PASSES" line names a file
