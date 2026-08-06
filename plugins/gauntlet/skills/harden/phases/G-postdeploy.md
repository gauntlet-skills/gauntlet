# Phase G — Post-deploy verification

**BLOCKED until the project is actually live.** Not N/A — it runs *after*
go-live. Marking it N/A because you have not deployed is how it never gets run.

> No completed run exists in the evidence base. One project reached G and
> recorded it BLOCKED (not deployed). The sequence below is derived from a real
> 11-phase launch-day runbook and from failures observed at other projects'
> cutovers — but it is a plan, not a transcript. Correct it from your first run.

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
- **A protected route while signed out** returns a redirect, not content.

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
- [ ] 24 hours elapsed with every error triaged
