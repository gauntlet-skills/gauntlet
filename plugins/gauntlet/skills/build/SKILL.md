---
name: build
description: Generate a sequential build document — the ~16 numbered build prompts that take a spec to a working, hardened app, each ending in a verifiable checkpoint. Covers the fixed core phases, per-feature phases, tail phases, inline during-build spot checks, and cross-prompt consistency. Use when the user says "build plan", "build doc", "build prompts", "BUILD.md", "scaffold the build", "turn this spec into prompts", or asks how to sequence building an app with an AI agent.
license: MIT
---

# Build Plan

## If the user hasn't described their app yet, ask for this

Do not start planning from a one-line idea. Ask them to fill in this shape, in
plain language — no jargon, no spec format:

```
I want to build: <one paragraph, like you'd describe it to a friend>

Who it's for:        <who>
What they can do:    <the 3–5 things a user can actually do>
What I charge:       <free / one price / tiers — or "decide for me">
```

Then ask the three questions that change the build: what has to be true for
someone to pay, what the one thing a new user must succeed at is, and whether
anything genuinely needs AI (if not, say no — it keeps the app simpler and
cheaper).

Full walkthrough for a first-timer: `QUICKSTART.md`. Never used a terminal?
`reference/cli-basics.md` explains what a CLI is and the five you'll touch.
`example/BUILD.md` is a complete worked example — it is the shape
`gates/lint-buildplan.mjs` checks for, and it passes.

Produces a **BUILD.md**: a numbered sequence of build prompts an agent executes
one at a time, each ending in a checkpoint that can actually be checked. Derived
from the Gauntlet scaffold generator and from Waypoint, which ran a 0–16 sequence
to completion.

Companion skill: the **harden** skill runs the A–G hardening cascade *after* the build.
This skill stops at a built, tested, deployable app. Do not inline the post-build
hardening here — see "Handoff" below.

> Invocation differs by host: Claude Code uses `/gauntlet:<skill>`, Codex uses
> `$<skill>`. Skill names below are given host-neutral.

## The output

One markdown file. Front matter, then numbered prompts, then the checkpoint after
each. Alongside it the build usually wants:

- **CLAUDE.md** — standing rules the agent re-reads every session
- **SPEC.md** — the app specification the prompts refer back to

**Generate one prompt per model call.** Trying to emit the whole document in a
single response truncates it, and a truncated build doc fails silently — the
agent just builds less.

## The sequence

Read `reference/sequence.md` for the full phase list and what each prompt owns.

```
Core (fixed)      1 · 2a · 2b · 3 · 4 · 5 · 6 · 7
Features          8 … N   — one per MVP feature, cap 8
Tail              Stripe · Legal/GDPR · Polish · Testing & CI/CD
```

Roughly 16 prompts for a typical app. The core and tail are fixed; only the
feature count varies.

## The specs

`reference/prompt-specs.md` holds the **actual per-phase specification** each
prompt is generated from — what it must instruct the agent to produce, with the
exact values. Twelve fixed specs covering core and tail; feature phases are
derived from the app's own spec.

`reference/standing-rules.md` holds the 16 Phase-Zero rules that apply to every
file, plus the guidance the agent needs for working effectively. These go into
the generated `CLAUDE.md` so they are re-read every session.

Both are generated from the generator source — regenerate rather than
hand-editing, or they drift.

## The prompt contract

Read `reference/prompt-format.md` before writing any prompt. The rules that get
broken most:

- **A prompt is an instruction, not code.** A one-line goal, then a numbered list
  of files with their key requirements and exact values. Never paste finished
  file contents — you are briefing a capable agent, not dictating to a typist.
- **250–600 words** per fenced prompt.
- **Every prompt ends with `### Checkpoint N`** — 5–10 verifiable items, placed
  *after* the closing fence so the agent can't mistake it for part of the prompt.
- **Exact values, not descriptions.** "minimum 12 characters" not "a strong
  password policy"; the actual table and column names; the pinned versions.

## Cross-prompt consistency

Independently generated prompts drift. These must be **byte-identical** wherever
they appear — in the schema, the validators, the routes, the UI copy, and
CLAUDE.md:

- Password policy (pick one number and never restate it differently)
- Table and column names — the schema prompt is the sole source of truth
- Plan/tier limits — defined once in a constant and referenced
- Storage bucket names and env var names — one spelling
- Any string a standing rule fixes

Drift here is the single most common cause of a build that typechecks and then
fails at runtime.

## During-build spot checks

Small audits baked **inline, under the prompt they apply to** — not batched at
the end. See `reference/spot-checks.md`.

This is the step most often skipped. Waypoint's build plan omitted them and had
to retrofit all four against finished code, which found real defects (a missing
`invoice.paid` handler, absent Stripe idempotency keys) that would have been
cheaper to catch at the prompt that introduced them.

> **Naming collision, worth knowing.** These inline checks get called "A1–A4" in
> some plans, and the post-build **harden** skill also has a Phase A with steps
> A1–A4. They are different sequences with overlapping content. When writing a
> plan, label these "Spot check after Prompt N" rather than "A1" and the
> ambiguity disappears.

## Service keys, by the prompt that first needs them

End the document with a table mapping each external service to the prompt that
first needs its key. A builder hits a wall when a prompt demands a credential
they haven't provisioned; this lets them get them in advance.

State explicitly where a placeholder works and where a live key is required —
Waypoint noted Sentry was "inert with a placeholder," which is exactly the detail
that keeps a build moving.

## The gate

Each prompt has its own gate: **the checkpoint**. A prompt is not done because
the files exist; it is done because the checkpoint items were verified.

Mechanical validation of the document itself:

```
gates/lint-buildplan.mjs BUILD.md
```

It checks structure — every prompt has a checkpoint, checkpoints are 5–10 items,
prompts are within the word budget, no prompt is smuggling in finished code. It
exits `0` clean · `1` problems found · `2` could not run.

It expects a **full build document**: each prompt as a fenced block with its
checkpoint after the fence. A lighter *plan index* — a numbered list with status
markers and no fenced prompts, which is a perfectly reasonable thing to keep
alongside — will report "no fenced prompt block" for every entry. That is the
linter working, not a false positive; it means the file is a tracker, and the
executable prompts live somewhere else or not yet at all.

A checkpoint item must be **verifiable by looking**. "Auth works" is not a
checkpoint item. "`POST /api/auth/login` returns 401 with no session" is.

## Handoff

When the last tail prompt's checkpoint passes, the build is done and the
**harden** skill takes over for A–G hardening.

Do not compress the post-build library into a single "run the hardening" prompt.
Waypoint's plan did exactly that — collapsing B1–B6 into one step and omitting
C through G entirely — and had to reconstruct the full sequence afterward. The
build plan's last prompt should hand off, not summarize.
