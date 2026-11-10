# Phase E — Pre-launch verification

The phase that answers "is it ready" with a defensible yes or no. E4 produces a
verdict someone can act on — and the most useful real verdict separated **code**
readiness from **operator** readiness, because the remaining blockers were config,
not engineering.

Steps: **E1** security checklist · **E2** dependencies · **E3** gap sweep · **E4** verdict

## E1 — Security checklist spot check

A fixed checklist, each item PASS / FAIL / N-A with the evidence. Report as counts
(e.g. 11 PASS / 2 N-A / 0 FAIL) so it is comparable across runs.

Items worth including: RLS coverage, ownership derived from session, auth on every
protected route, sanitized client errors, secrets in env only, CORS allow-list,
signed webhooks, rate limits fail-closed, CSRF fails closed, audit logging, no
service-role key reachable from the client.

N-A needs a reason. "Not implemented" is FAIL, not N-A — that distinction is the
whole point of the checklist.

## E2 — Dependency audit

- Run the audit. Triage by **reachability**, not by CVSS: a critical in a dev-only
  transitive dep that never runs in production outranks nothing.
- Patch the reachable ones with targeted version bumps.
- **Never `npm audit fix --force`.** It breaks transitive deps.
- Write the deferred ones to `docs/dep-watch.md` with the reason each is not
  reachable, so the next run doesn't re-triage from scratch.

## E3 — Gap sweep

Everything the phases didn't cover, especially operational. This is where the
real launch blockers hide, and they are usually not code:

- Email DNS (SPF/DKIM/DMARC) on the sending domain — highest-impact item found.
- Production env vars actually set on the host.
- Key rotation for anything exposed, including anything a CLI printed unmasked.
- Cron monitors so a silently-failing scheduled job is noticed.
- Uptime alerting, backup and restore drill, load test, accessibility audit.

Rank P0/P1/P2. P0 blocks launch; P1 runs in parallel with a soft launch; P2 is
before scaling.

### Lighthouse

Run the Lighthouse CLI against every public page that matters: landing,
pricing, signup, login, and one content page. It is the cheapest objective
check of performance, accessibility, best practices and SEO, and it finds
things code reading misses (contrast, tap-target size, render-blocking
scripts, layout shift).

```
npx lighthouse http://localhost:3000/ --chrome-flags="--headless=new" \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output=html --output-path=./docs/lighthouse/home
```

- **Run it against a production build** (`npm run build && npm start`, or a
  preview deployment), never the dev server. A dev server is unminified and
  unbundled, so its performance score means nothing.
- **Mobile first.** The default emulates a throttled phone. Run it again with
  `--preset=desktop`. Mobile is the one that usually fails.
- **Performance shifts by several points between runs.** Run three times and
  report the median. Accessibility, best practices and SEO are stable.
- **It cannot log in.** For signed-in screens, run the Lighthouse panel in
  Chrome DevTools while signed in, or list those screens as unverified. Don't
  leave them out without saying so.
- **It needs a Chromium browser.** If none is found, set `CHROME_PATH` to an
  installed Chrome or Edge.
- **Read the audits, not just the four scores.** Every failing accessibility
  audit is a finding. LCP, CLS and TBT name the actual performance problem.
  The SEO category is a mechanical cross-check of D1, not a replacement for it.

Report a table: page × mobile/desktop × the four scores. Aim for 90+ in each
category. Below that, the failing audits become findings, ranked by page.
Signup and checkout come before marketing pages. Keep the JSON reports so
Phase G can compare production against them.

## E4 — Readiness verdict

Two parts.

**Mechanical gate** — run `gates/run-gate.sh` and paste the table verbatim.
Include the coverage number and whether the secret scanner is canary-verified.

**Launch-gate questions** — answer each in prose, with evidence:

1. Anything preventing safely accepting real payments?
2. Anything that would cause a data breach under normal use?
3. Anything that would crash at 100 simultaneous users?
4. Anything the app stores would reject? *(mobile only)*

Then the verdict. **Separate code-ready from operator-ready.** The most useful
real verdict read: *WEB: CODE-READY — deployable once the four P0 operational
items are done. MOBILE: NOT READY.* That is actionable in a way that a single
red/green is not.

Answer honestly about what is unverified. "No known crash path, but load is
unverified" is a better answer than either "it's fine" or "it's not ready."

## Gate

Judgment — Phase E does not pass until:

- [ ] E1 reported as counts with evidence per item; no item marked N-A without a
      reason; nothing marked N-A that is really FAIL
- [ ] E2 triaged by reachability; deferrals written down with reasons
- [ ] E3 gaps ranked P0/P1/P2
- [ ] Lighthouse run against a production build, mobile and desktop, on every
      public page in scope; the score table pasted from this run; signed-in
      screens either audited or listed as unverified
- [ ] E4 answers all four questions with evidence
- [ ] E4 separates code blockers from operator blockers, and lists the operator
      ones explicitly
- [ ] The mechanical gate table is pasted from a real run, this run
