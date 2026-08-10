# What a build prompt looks like

## Shape

````markdown
## Prompt 6 — Authentication

```
Build email + password authentication. All auth goes through server API routes;
no client-side sign-in calls.

1. `src/lib/auth/lockout.ts` — record attempts in `login_attempts` (columns:
   `email`, `ip_address`, `created_at`). Lock after 10 failures in 15 minutes,
   for 30 minutes. Index on `email` and on `ip_address`. IP throttling is the
   primary control; per-email lockout is secondary.

2. `src/app/api/auth/signup/route.ts` — Zod: email, password min 12 chars with
   upper, lower, number, symbol. Verify the bot-protection token server-side
   before creating the user. Generic error messages.

3. `src/app/api/auth/login/route.ts` — check lockout, then authenticate.
   Identical response shape and a 500ms floor on every outcome so timing does
   not leak account existence.

4. ... etc
```

### Checkpoint 6

- [ ] `POST /api/auth/login` with no session returns 401
- [ ] 11th failed login in 15 min returns 429; a 12th still returns 429
- [ ] `/forgot-password` returns the same body for a known and unknown email
- [ ] Signup rejects an 11-character password with a 400
- [ ] Signup without a bot-protection token returns 400
- [ ] Auth route file list matches SPEC.md exactly
````

## The five rules

**1. Instruction, not code.** A numbered file list with requirements. Never paste
finished file contents. Pasted code gets copied verbatim including the parts that
don't fit the project, and it makes the document enormous for no gain.

**2. Exact values.** "min 12 characters" not "strong password policy". Real table
and column names. Pinned versions. Actual env var names. Every place you write a
description instead of a value is a place two prompts will disagree.

**3. 250–600 words per prompt.** Under 250 and the agent is guessing. Over 600
and it starts dropping requirements from the middle.

**4. The checkpoint goes after the closing fence.** Inside the fence it reads as
part of the instruction and the agent tries to build it.

**5. One prompt per model call when generating.** Emitting the whole document at
once truncates, and truncation is silent.

## Checkpoint items must be verifiable by looking

The test: could someone who did not write the code confirm this in under a
minute, without judgment?

| No | Yes |
|---|---|
| Auth works | `POST /api/auth/login` with no session returns 401 |
| Rate limiting is in place | 11th request in 60s returns 429 |
| The schema is correct | `\d profiles` shows `subscription_tier` NOT NULL default `'free'` |
| Errors are handled | A thrown error in a route returns a generic 500, and the detail appears in the monitor |
| RLS is set up | Querying another user's row by UUID as an authenticated user returns 0 rows |
| Good test coverage | `npm run test` exits 0 with ≥1 test asserting the rate limit blocks |

Five to ten items. Fewer and the prompt is under-specified; more and they stop
being read.

**At least one item per checkpoint must be able to fail.** A checkpoint of six
items that are all "the file exists" verifies nothing — the agent wrote the
files, that is not in question. Check *behaviour*: what happens on the error
path, what the limit does at the boundary, what an unauthorized caller gets.

## Front matter

Before Prompt 1:

- **App specification** — name, description, target users, routes, pinned tech
  stack, account types, tiers, env vars bucketed REQUIRED / FEATURE / OPTIONAL
- **Standing rules** — the non-negotiables that apply to every file, which also
  go in CLAUDE.md so the agent re-reads them each session

## After the last prompt

- **Service keys table** — each service mapped to the prompt that first needs it,
  noting where a placeholder is enough
- **Handoff to the harden skill** for A–G hardening. A pointer, not a summary
