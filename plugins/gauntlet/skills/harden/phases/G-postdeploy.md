# Phase G — Post-deploy verification

**BLOCKED until the project is actually live.** Not N/A — it runs *after*
go-live. Marking it N/A because you have not deployed is how it never gets run.

> **First real run: medcomplex-pro, 2026-08-10** (`docs/G-postdeploy-verification.md`).
> Partial — the credentialed flows were not run — but it found a HIGH on its
> first pass: a production health endpoint returning 503, caused by
> configuration rather than code. The notes below marked *"from the first run"*
> come from that; the rest is still derived from a launch-day runbook and from
> cutover failures on other projects.

## Why this phase exists

Every prior phase verified code. G verifies **the thing serving users**, on real
infrastructure, with real config, real DNS, and real money.

That distinction is not academic. In this evidence base, every remaining launch
blocker at the final readiness verdict was **operational, not code** — and one
project shipped `unsafe-eval` in its production CSP past a full A–E gauntlet
because every phase read source and none read the wire.

## Immediately after deploy

Against production, not a preview URL.

- **The deployed commit is the one you think it is.** Check the release hash
  against `git log`. Error monitors report it; compare them.
- **Every migration is applied — all of them, not just the newest.** Deployed
  code queries columns introduced by migrations in the middle of the stack. This
  has broken a real cutover.
- **Env vars present in production.** A missing one usually surfaces as a 500 on
  one route, not a boot failure, so it hides.
- **Header audit against the live origin:**
  ```
  MSYS_NO_PATHCONV=1 node gates/check-headers.mjs https://your-app.com / /login /api/health
  ```
  This is the only place platform-injected headers are visible.
- **A protected route while signed out** returns a redirect, not content. Check
  the redirect *preserves the intended destination* — a bare `/login` with no
  `redirectTo` is a UX bug that only appears in production.
- **Hit the health endpoint.** *From the first run:* this is the cheapest check
  in the phase and it was the only one that failed. If the app has no health
  endpoint, that is itself the finding — add one before launch, not after.

## The two end-to-end flows

Everything else is a proxy for these.

**Signup, with a real address.** The highest-value single check in the phase. The
verification email must arrive **in an inbox, not spam**, and its link must land
on the right page. This exercises email DNS, the redirect allow-list, and the
auth site URL simultaneously — each of which has failed independently in a real
project.

**Payment, with a real card in live mode, then refund it.** Confirm the webhook
was received, the subscription row updated, and the entitlement actually applied
in the UI. Then confirm the refund reverses it.

## Configuration that can only fail in production

- **Auth site URL** set to production. If it is still localhost, every
  confirmation link breaks for every user — including, retroactively, anyone who
  already signed up.
- **Redirect allow-list** contains the production and localhost globs. A
  `redirectTo` not on the list is silently dropped to the site URL, so the path
  and query are lost and reset links land on the homepage with an unhandled code.
- **Custom SMTP** wired. Default auth emails look like spam and get filtered.
- **Email DNS** — SPF, DKIM, DMARC on the sending domain. Without it, verification
  mail spams and nobody activates.
- **Cron jobs fire.** Check for an actual execution record. An empty run history
  reads exactly like a healthy one.
- **Secrets rotated** for anything a CLI printed unmasked or that was shared
  during setup.

## Narrowing a failure you can only see from outside

*From the first run.* A good health endpoint deliberately does **not** say which
dependency failed — exposing infrastructure detail publicly is worse than the
inconvenience. So when it reports degraded, narrow it by behaviour instead of
guessing:

- **Fail-closed rate limits are a Redis probe.** Send one invalid-payload request
  to an auth route. A 429 means the limiter failed closed, so Redis is down. Any
  other response means Redis is reachable.
- **Anon-key vs service-role is the sharpest split.** If public routes work and
  only admin paths fail, the service-role credential is the suspect — and a
  rotated key that was never updated in the host's environment produces exactly
  that signature. This is what the first run found.
- **Prefer one safe probe to several.** Use a payload that creates nothing and an
  endpoint with anti-enumeration, so the diagnostic leaves no trace and tells the
  attacker-shaped observer nothing.

The general lesson: **a health check that hides which dependency failed is
correct, and it means you need a narrowing procedure.** Write down which of your
routes touch which dependency before you need it at 2am.

## Prove the monitoring works

A silent error dashboard is ambiguous between "no errors" and "not wired," which
is the same failure the whole gate doctrine exists to prevent.

- **Plant a test error** and watch it arrive. Then remove it.
- Confirm PII scrubbing on the way in — breadcrumbs, URLs, and search terms reach
  the vendor unscrubbed by default.
- Confirm cron monitors alert on a *missed* run, not just a failed one.

## First 24–48 hours

- Triage every error. Do not let volume normalize.
- Watch spend against every cap — AI, database, bandwidth, email. Confirm the caps
  are actually enforced, not merely configured.
- Confirm rate limits are firing on abuse and **not** on real users.
- Watch signup completion rate. A drop-off cliff between signup and verification
  means email.

## Gate

Judgment — Phase G does not pass until:

- [ ] Deployed release hash matches the intended commit
- [ ] All migrations applied and verified, not just the latest
- [ ] Header audit run against the live origin
- [ ] Signup completed end-to-end with a real email that **landed in an inbox**
- [ ] Payment completed and refunded in live mode *(if applicable)*
- [ ] Auth site URL and redirect allow-list verified against production
- [ ] Cron jobs show real execution records
- [ ] Error monitor confirmed receiving via a **planted test error**
- [ ] Spend caps verified enforced
- [ ] Health endpoint returns healthy — not degraded, not absent
- [ ] 24 hours elapsed with every error triaged

## Partial runs are INCOMPLETE, not passed

*From the first run.* Several checks here need credentials, a real mailbox, a
real card, or dashboard access, and an agent cannot do them for you. Record those
as **NOT RUN** with the reason and mark the phase incomplete. A phase document
that quietly omits the checks nobody could run reads exactly like one where they
passed — the same failure this whole cascade is built to prevent, one level up.
