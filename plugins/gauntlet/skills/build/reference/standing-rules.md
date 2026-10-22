# Standing rules

The non-negotiables that apply to every file in the build. These go into the
generated `CLAUDE.md` so the agent re-reads them every session — that repetition
is the point, because an agent that has drifted will not remember them otherwise.

Generated from the generator source by `scripts/extract-build-specs.ts`.

---

## PHASE-ZERO: NON-NEGOTIABLES (BASE — apply to EVERY file, function, and prompt)

**Rule 1 — No Secrets in Code.** ALL secrets in environment variables. `.env.example` with
placeholder names only. Server files start with `import 'server-only'`. ESLint blocks server
env access in client files.

**Rule 2 — Validate ALL Env Vars at Startup.** `src/lib/env.ts` with Zod schemas for server
and client vars. App crashes immediately if required vars are missing. Never read `process.env`
directly. Expose `npm run env:validate`.

**Rule 3 — RLS on Every Table, Every Bucket, From Day 1.** No table without Row Level Security.
Workspace scoping uses ONE canonical pattern: a `SECURITY DEFINER STABLE` helper
`is_workspace_member(workspace_id)` (defined in the first migration) called by every policy —
never `auth.jwt()->>'workspace_id'` (needs custom claims) and never a raw `EXISTS(SELECT … FROM
workspace_members)` inline (42P17 recursion). Service role key used ONLY in admin/server operations.

**Rule 4 — Fail-Closed Limits + Caching on Every Paid API.** Any metered/paid external API
(AI/LLM, SMS, email, maps, enrichment, background checks, etc.) MUST have all three, or it is not
allowed to be called: (a) a per-user rate limit that FAILS CLOSED — if Redis is down, return
blocked (429), never fail-open; (b) a spend cap checked before every call — a per-user cost ceiling
AND a global daily/monthly ceiling; and (c) response CACHING — dedupe identical requests by a hash
of the inputs and serve the stored result instead of paying the provider again. Caching a paid
call is a cost control, not an optimization: the same input must never be billed twice.

**Rule 5 — Generic Error Messages to Client.** API routes return a generic message for 500s.
Detailed errors go to Sentry only. Never expose stack traces, column names, or internal detail.

**Rule 6 — Every API Route Checks Auth First.** Get session, verify user, return 401 if missing.
Ownership verified on every data request (not just identity) — `OwnershipError` returns 404.

**Rule 7 — Zod Validation on Every Input.** Every `request.json()` followed by `.safeParse()`.
Every URL parameter validated. Return 400 with a generic message on failure.

**Rule 8 — Webhook Idempotency.** Every Stripe webhook claims the event BEFORE processing: INSERT
the event id into `webhook_events` (UNIQUE `stripe_event_id`) and let the unique constraint reject
a duplicate — on conflict, return 200 and do nothing. Never SELECT-then-process: two concurrent
retries both pass a read check. Raw body via `request.text()`; signature verified; all 6 events handled.

**Rule 9 — No Placeholder Code.** No `// TODO`, no `console.log('test')`, no mock data in
production paths, no stub functions. Every function called must be implemented.

**Rule 10 — CSRF Protection.** All POST/PATCH/DELETE/PUT verify the Origin header against
`NEXT_PUBLIC_APP_URL`. Skip CSRF on `/api/stripe/webhook`. Reject missing/null Origin (403).

**Rule 11 — Double-Submit Prevention.** Every form submit button disabled while a request is
in flight (`isPending`/`isSubmitting`).

**Rule 12 — Server-Side Auth Routes.** Login and signup through server API routes only. No
direct client-side `supabase.auth.signInWithPassword` calls.

**Rule 13 — Legal Compliance for Monetization.** Privacy policy, ToS, cookie consent required
before accepting payments. GDPR data export and deletion endpoints required. NEVER claim a
certification the product does not hold — no "HIPAA compliant/ready", "SOC 2", "PCI", "FedRAMP",
"COPPA", "GDPR certified", or "BAA" badges anywhere in the UI or copy. Describe real controls only;
a certification requires a signed audit/BAA the software cannot self-declare.

**Rule 14 — AI Model in Env Var (AI features only).** IF the App Specification gives the product an AI feature, model ids come from env vars (never hardcoded) using ONE canonical naming scheme, byte-identical across the whole codebase: a single model → `AI_MODEL`; multiple DISTINCT models → EXACTLY `AI_CLASSIFY_MODEL` / `AI_DRAFT_MODEL` / `AI_EMBED_MODEL` (one spelling per purpose — NEVER two names for the same model, e.g. `AI_CLASSIFICATION_MODEL` and `AI_MODEL_CLASSIFY`). Use ONE AI provider for the whole app UNLESS a required capability (e.g. embeddings) is unavailable from it, in which case use the second provider ONLY for that capability with equally consistent env var names. Log the model at startup. Throw a deprecation error on a model-not-found 404 so it surfaces to Sentry, not as a generic 500. IF the app uses NO AI, this rule does not apply — do NOT add an AI client, an AI_MODEL env var, or any AI scaffolding; unused AI boilerplate must not appear in a non-AI product.

**Rule 15 — Track AI Token Cost Per Operation (AI features only).** IF the app has an AI feature, every AI call stores input/output tokens and
USD cost to the relevant row immediately after the call. Rate-limit every AI endpoint per user,
and set a global provider spend cap before launch. IF the app uses no AI, this rule does not apply.

**Rule 16 — Dev/Prod Environment Separation.** Development and testing must never touch production data or live payments. (a) ALL config is read through `env.ts` (Rule 2) with nothing environment-specific hardcoded, so the SAME code runs any environment purely on its env values. (b) Provision SEPARATE instances per environment and document the split in `.env.example`: a separate Supabase project for production (never share the dev project's database), a separate Upstash Redis database OR a documented `dev:`/`prod:` key prefix, and Stripe in TEST mode for dev / LIVE mode for prod. One Redis database serves many purposes via key prefixes — you do NOT need a separate database per feature; separate databases are only for environment isolation. (c) Add a startup guard in `env.ts` that REFUSES to boot in production when it detects dev/test config — a Stripe test key (`sk_test_`), a `localhost` app URL, or any dev-bypass flag — failing fast with a clear message (same discipline as Rule 2). (d) Dev values live in `.env.local` (gitignored, never deployed); production values live ONLY in the host's Production environment variables (e.g. Vercel Production). Never commit either, and never reuse one environment's keys in another.

---

# Working with the agent

## Working With Claude Code (read this before Prompt 1)

These habits matter as much as the prompts themselves.

**Ask for the simpler way — every time.** Before you accept a prompt's approach, ask Claude Code:
_"Is there a simpler, leaner way to do this that still satisfies the Phase-Zero non-negotiables?"_
The build prompts aim for production-grade, but they can over-build for your scale. Claude Code is
good at proposing a lighter path — a built-in instead of a library, less config, one fewer service —
when you ask. Take the simpler option unless it would break a non-negotiable.

**Let Claude Code self-correct — it reliably does.** The mechanical things that break during a
build — a failed migration, a type error, a bad import, a test that goes red — Claude Code catches
and fixes on its own. When you first paste the scaffold, it will almost always spot issues up front,
make the corrections, and steer the build plan in the right direction before you get far. So you do
NOT need a perfect scaffold; you need one that starts and gets corrected fast. Paste any error you
see straight back into the session and let it work — this is what it's best at.

What it will NOT flag for you are the SILENT problems — a missing auth check, an over-permissive RLS
policy, an unbacked compliance claim — because nothing errors out and the build still runs. Those are
exactly what the post-build audit prompts hunt down, so run them; don't skip them because the app
"works."

**One phase per session, checkpoint before moving on.** Paste one numbered prompt, run its
checkpoint, and only advance when it passes. Commit after each phase so a bad one is easy to undo.

**Push back on complexity you can't explain.** If a step adds something you couldn't describe in a
sentence, ask why it's there and what breaks without it. If the answer isn't a non-negotiable, it's
a candidate to cut.

**Show it what you want — paste images for UI.** Claude Code can see images. Screenshot an app whose
interface you like, save a design or mockup, or download a reference, and paste/upload it straight
into the session: "make the dashboard look like this." Matching a picture is far faster and more
accurate than describing a layout in words — this is the single best way for a non-designer to get
a UI they're happy with.

---

## How to Use This Document

**First: keep the build files together.** The build skill writes three files into
your project folder: this BUILD.md, CLAUDE.md and SPEC.md (plus BUILDER_RULES.md if
part of the app is built in a tool that never reads repo files). Open the agent in
that folder. All three need to be present for the build to work.

This document has two kinds of content. Only one kind gets pasted into the agent.

**PASTE INTO THE AGENT** — the numbered build prompts (`## PROMPT 1`, `## PROMPT 2a`, …),
one per session, and the post-build audit prompts when you reach them. Each is a complete
instruction. Run the checkpoint after each phase before moving on.

**READ YOURSELF — do NOT paste** — the Phase-Zero Non-Negotiables (captured into CLAUDE.md),
the App Specification table, the checkpoints (you ask the agent to "Run Checkpoint N"),
and everything under "How to Use". These are reference, not instructions.

### Session 1 (Prompt 1 only)
```
Read SPEC.md and CLAUDE.md in full before doing anything.

[paste Prompt 1 here]
```
Prompt 1 validates the spec and commits CLAUDE.md and SPEC.md.

### Every session after Session 1
```
Read CLAUDE.md, SPEC.md and BUILD.md before doing anything.
Check git log for the last phase committed.
Report: what phase we're on, what's complete, what's next.
Then wait for my instruction before changing any files.

Non-negotiables from CLAUDE.md apply to this entire session.
```
Wait for the orientation report, then paste the next phase prompt. The agent has no
memory between sessions, so the context block is needed every time.

<!-- source-sha256: 36cca91795a5 -->

That comment is the hash of the source this was built from. Run
`gates/check-extracted.mjs` to verify this file has not been edited since.
