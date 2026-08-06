# Known patterns

Defects found in real gauntlet runs across medcomplex-pro, coachflow,
globalenglishtech, cyberjobs-pro, gauntlet, and waypoint. Every entry here was
live in a project that had already passed something.

Check these first. They recur because they come from how the stack behaves, not
from a particular team's mistakes — which means your app probably has some of
them too.

---

## The gate that never ran

**`check-secrets.sh` reported `OK: No hardcoded secrets found` for the entire life
of the repository, and had never once executed.**

The excludes array was double-quoted, so bash did not strip the backslash from
`\!`. git received a literal `":\!scripts/..."` pathspec and rejected it with a
fatal. That fatal went to stderr, piped to `/dev/null`. `git grep` exited
non-zero, which the script read as "no matches."

It passed a **planted live key**.

Nobody caught it by reading the script — it was caught by planting a canary. A
second instance of the same class turned up later in a different project: a
Node rewrite of the same scanner exited `0` with a friendly "Skipping" message
whenever the build output directory was absent, so on any clean checkout it
reported a pass having scanned nothing.

**Check:** does your scanner distinguish *clean* from *did not run*? Plant a
key-shaped string and watch it go red. If you cannot make it fail, it is not a
gate. See `gates/GATES.md`.

---

## Auth

**Expired lockout immediately re-locks → permanent, unrecoverable account
lockout.** The check read "has there been a lockout" rather than "is the lockout
still active," so the moment it expired the next attempt re-triggered it. Users
could never get back in.

**Per-email lockout as the primary control.** Lets an attacker lock any user out
by guessing their email. IP throttling must be primary; per-email secondary.

**Rate-limit headers on auth 429s.** `Retry-After` and `X-RateLimit-*` expose
per-key reset windows, so a targeted real address returns a different window than
an address that does not exist — an enumeration oracle. Their **absence on auth
routes is the control**. Scanners flag it; comment the route so a later audit
does not "fix" it.

**Email verification forcing a re-login.** A dead end at the highest-drop-off
moment in the funnel.

---

## Payments

**Read-then-process webhook idempotency.** Checking `webhook_events` and *then*
inserting leaves a window that retry storms drive straight through. Insert first,
let the unique constraint reject the duplicate.

**Missing `invoice.paid`.** A silent revenue bug — everything looks fine and
subscriptions quietly never renew. Found on retrofit, not during the build.

**No idempotency keys on outbound charge calls.** A retried checkout charges
twice.

**Two providers, one row, one watermark.** Stripe and a mobile IAP provider
writing the same profile row clobber each other. Needs a provider discriminator
and reconciliation.

**Out-of-order guard on some handlers but not the happy path.** The most-used
handler skipped the guard the others used.

---

## Data access

**Ownership derived from a request parameter rather than the session.** Query by
UUID as another user and see whether rows come back. This is the highest-value
single check in the whole gauntlet.

**403 on an ownership failure.** Confirms the resource exists. Return 404.

**Raw `EXISTS` subqueries in RLS policies.** Recurses — Postgres `42P17`. Use a
`SECURITY DEFINER STABLE` helper and call it from every policy.

**Storage buckets without policies.** A separate surface from tables, and
routinely missed because "RLS is on" refers to tables only.

---

## The UI lies

**The onboarding payoff action silently does nothing.** A guided flow walked the
user through adding their first item; it never scheduled, and the dashboard then
said "no items." The single worst finding of any run — and invisible to every
security phase, because nothing was insecure. It just did not work.

**Blank screen on fetch failure.** An error branch that renders nothing reads as
"your data is gone." Check every screen's failure path, not just its success
path.

**Fabricated data.** A weekly adherence ring computed from nothing, rendered to
every user, looking authoritative. Users trust charts.

**Client-only onboarding gates.** Bounce-loop forever.

**User-facing numbers drifting from their source constant.** Pricing pages
disagree with the plan table. Trace every number in copy back to the constant.

---

## Headers and the deployed surface

**The whole class:** these exist only in the HTTP response. They are in no source
file, so no amount of code review finds them. Run
`gates/check-headers.mjs` against the deployed origin.

**Platform-injected wildcard CORS.** Vercel adds `Access-Control-Allow-Origin: *`
to statically prerendered responses. Present on four of six audited apps; absent
on the one whose routes are all dynamic. In no config file. Impact is low on
public pages (a wildcard ACAO forbids credentials) but it recurs on every new
project, so pin ACAO to your own origin in `next.config.ts`.

**`unsafe-eval` shipped to production.** Needed by the dev server, catastrophic
to ship — it re-enables `eval()`. Found live on a **health-data app that had
passed phases A through E**, scored 11 PASS / 0 FAIL on its security checklist,
and been declared "no code defects blocking a web launch." Every one of those
phases read source. None read the wire.

**`x-powered-by` disclosing the framework.** One line: `poweredByHeader: false`.

---

## CI and deploys

**CI that has never run.** A workflow watching `main` in a repo whose branch is
`master`. `gh run list` returns empty, which reads exactly like a passing
history. Turning it on surfaced five latent bugs immediately.

**Only the newest migration applied at cutover.** Deployed code queries columns
introduced by migrations in the *middle* of the stack. Apply every missing one.

**Auth site URL still pointing at localhost at first signup.** Breaks every
confirmation link, retroactively, for everyone who already signed up. Change it
before the first real user, not after.

**`redirectTo` not on the redirect allow-list.** Silently dropped to the site
URL, so path and query are lost and reset links land on the homepage with an
unhandled code.

**`SECURITY DEFINER` functions without `SET search_path = public`.** Work
perfectly in the SQL editor, then 500 on signup under the auth service.

---

## Process

**Auditing from the spec instead of the code.** The "What PASSES" section is
where this shows up. If you did not open the file, it does not go there.

**A zero-finding first-run audit.** Every real first run in this evidence base
found something. Zero findings means the audit has not been run properly yet.

**Scanners tuned until quiet.** A regex scanner with no cross-file resolution
cannot see that a named helper implements the check it is looking for; on a
mature codebase that is near-total false positives. Verify a sample against real
code before acting on any of it — and before tuning. A gate tuned for silence has
been disabled slowly.
