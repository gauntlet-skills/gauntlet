# Phase B — Security cascade

The broad sweep. Unlike other phases this is a **cascade**: audit, fix, re-audit,
harden, then check the deployed surface. The re-audit is not ceremony — fixes
introduce findings, and B3 exists because that has happened.

Steps: **B1** audit → **B2** fix → **B3** reaudit → **B4** hardening → **B6** domain

> B5 has no evidence in any completed run. If you use the slot, define it in the
> phase document rather than inheriting an assumption.

## B1 — Comprehensive security audit

Read code. Group findings by severity, not by subsystem.

Surfaces that produced real findings in past runs:

- **Auth** — lockout logic (an expired lockout that immediately re-locks is a
  permanent, unrecoverable lockout: medcomplex B1-AUTH-1), anti-enumeration on
  reset, consistent response timing, IP-based throttling as the *primary* control
  with per-email lockout secondary — the reverse lets an attacker lock out a
  victim by guessing their email.
- **Subprocessor disclosure** — every third party that touches user data must be
  named in the privacy policy. A policy that affirmatively denies a subprocessor
  you actually use is worse than silence (medcomplex B1-SEC-1).
- **Error monitoring leakage** — breadcrumbs and URLs reach the monitoring vendor
  unscrubbed. Search terms, tokens in query strings, PII in paths.
- **Notification content** — titles and bodies land on lock screens and pass
  through APNs/FCM. Anything sensitive in them is a disclosure.
- **Security theatre** — a feature whose copy claims verification it does not
  perform (an app lock that checks nothing) is a HIGH, not a polish item.
- **CSRF** — fails closed, including on a missing or null `Origin`.
- **Input validation** — schema-validated at every entry point, with generic
  messages to the client.
- **Rate limiting** — fail-closed. A limiter that fails open when Redis is down
  is not a limiter. In-memory limiters do not work on serverless.

## B2 — Fix pass

Work CRITICAL then HIGH, in the order B1 recommends. Consolidate related fixes —
medcomplex found consolidation a strict gain over one-commit-per-finding.

Do not fix and re-audit in the same pass. The point of B3 is fresh eyes on the
diff.

## B3 — Reaudit

Re-run B1's method against the fixed code. Specifically:

- Every CRITICAL/HIGH from B1 is verified closed **by reading the fix**, not by
  trusting the commit message.
- The diff itself is audited. Fixes introduce findings.
- B1 LOWs still open are carried forward explicitly.

## B4 — Hardening

Beyond fixing defects: security headers (CSP, HSTS, X-Frame-Options,
X-Content-Type-Options, COOP/CORP), performance indexes on the paths RLS makes
hot, audit logging on sensitive actions, dependency posture.

Batch the N+1s you found in C — they are usually the same queries.

## B6 — Domain audit

The deployed surface, not the code: DNS, TLS, email authentication (SPF, DKIM,
DMARC), redirects, cookie flags and scope, CORS allow-list.

**Run the header audit first** — several defect classes exist only in the
deployed response and are absent from your source entirely, so code review can
never find them:

```
MSYS_NO_PATHCONV=1 node gates/check-headers.mjs https://your-app.com / /pricing /login /api/health
```

It classifies each route as static / dynamic / api and judges headers in that
context, because the same header means different things per class. Exits
`0` clean · `1` findings · `2` could not run.

The finding it exists for: **hosts inject headers you did not write.** Vercel
adds `Access-Control-Allow-Origin: *` to statically prerendered responses. It
appears in no config file and no source file; the only way to see it is to look
at the wire. Impact on public prerendered pages is low — a wildcard ACAO forbids
credentialed requests, so nothing authenticated can be read — but it is real,
and an external scanner will keep reporting it until it is pinned to your own
origin in `next.config.ts`.

**Judge severity by route class, not by header name.** A wildcard ACAO on
`/api/*` is HIGH; on a static marketing page it is LOW. External scanners
routinely report the second as Medium because they do not model the difference.

**Where a missing header is the correct answer.** Auth endpoints should return
429 *without* `Retry-After` / `X-RateLimit-*`. Those headers expose per-key reset
windows, and a targeted real address then returns a different window than an
address that does not exist — an account-enumeration oracle. Scanners flag the
absence; the absence is the security control. Comment it in the route so a later
audit does not "fix" it.

**Email auth is the one that silently ruins a launch.** Without SPF/DKIM/DMARC on
the sending domain, verification email lands in spam and no user can activate.
It was medcomplex's highest-impact remaining blocker at E4.

## Gate

Mechanical: `gates/run-gate.sh`.

Judgment — Phase B does not pass until:

- [ ] B1 findings each have an ID, severity, file:line, and a fix
- [ ] Every B1 CRITICAL/HIGH verified closed in B3 **by reading the code**
- [ ] The B2 diff itself was audited in B3
- [ ] Open LOWs listed under "Carried forward"
- [ ] B6 run against the real domain, not localhost
- [ ] Zero CRITICAL, zero HIGH open
