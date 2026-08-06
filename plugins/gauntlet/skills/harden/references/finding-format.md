# Phase document format

One markdown file per phase step, written to `docs/` **before** any fix is
applied. Consistency is what lets phase E cross-reference phase B and lets a
later run tell what carried forward.

## Filename

```
docs/security/A1-payments-audit.md
docs/security/B1-audit.md
docs/ux/C1-funnel-audit.md
docs/E4-readiness-verdict.md
```

Security work under `docs/security/`, UX under `docs/ux/`, everything else at
`docs/` root. Match whatever the repo already uses if it differs.

## Structure

```markdown
# B1 — Comprehensive Security Audit

Date: YYYY-MM-DD.

## Headline

One or two sentences a stakeholder could read alone. Lead with the worst thing
found, or state plainly that nothing blocking was found. Not a summary of what
you did — a statement of what is true.

## CRITICAL / HIGH / MEDIUM / LOW

### B1-AUTH-1 — HIGH — Expired lockout immediately re-locks → permanent lockout

**Where:** `src/lib/auth/lockout.ts:42`
**What:** [the defect, concretely]
**Why it matters:** [the user-visible or business consequence]
**Fix:** [what to change]

## What PASSES — verified, not assumed

- RLS on 40/40 tables — checked `supabase/migrations/*.sql`, every `create table`
  has a matching `enable row level security`.
- Webhook signature verified — `app/api/stripe/webhook/route.ts:18`.

## Mechanical gate

[paste the table from gates/run-gate.sh]

## Carried forward

LOW findings from earlier phases still open, re-listed so they cannot evaporate.
```

## Finding IDs

`{STEP}-{CATEGORY}-{N}` — `B1-AUTH-1`, `C1-CRIT-2`, `A1-F3`.

Stable forever. A later phase referencing `B1-AUTH-1` must still resolve. Never
renumber; if a finding is withdrawn, keep the ID and mark it WITHDRAWN with the
reason.

Categories in use across real runs: `SEC` `AUTH` `ERR` `VAL` `CSRF` `MOB` `CRIT`
`HIGH` `MED` `LB` `F{n}`. Add categories freely; do not rename existing ones.

## Severity

| | Meaning | Blocks? |
|---|---|---|
| CRITICAL | Data loss, breach path, money moves wrongly, or the core flow is broken for every user | Yes |
| HIGH | Exploitable with preconditions, or a flow broken for a subset of users | Yes |
| MEDIUM | Real defect, contained blast radius, has a workaround | No |
| LOW | Hygiene, polish, latent risk | No |

Assign severity by consequence, not by how hard it was to find.

## The "What PASSES" section is the honest part

This is where an audit either earns trust or quietly loses it. Every line names
the file and what was actually checked. If you did not open the file or run the
command, it does not belong here.

The heading is literally "verified, not assumed" because the failure mode is
writing down what the spec promises rather than what the code does.

## Zero-finding audits

A first-run audit that finds nothing is suspect. Every first run in the evidence
base found something. Before writing "no findings," state where you looked and
what you ruled out — then look at the thing you have not looked at yet.
