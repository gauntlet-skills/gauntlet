---
name: review
description: Diff-scoped multi-agent code review with adversarial verification. Fans out parallel reviewers across correctness, security, performance and interaction, then spawns skeptics whose only job is to refute each finding — so what survives is what a skeptic could not break. Use when the user says "review this", "review my changes", "code review", "review this PR", "diy-review", or asks whether a change is safe to merge. EXPENSIVE — spawns many subagents; see the cost section before running.
license: MIT
---

# Review

A diff-scoped review that produces the signal of a careful senior reviewer with
false positives aggressively suppressed. It is deliberately expensive; the cost
buys the verification pass, which is the part that makes the output trustworthy.

Companion skills: **`gauntlet:build`** produces the app, **`gauntlet:harden`**
audits the whole project before launch. This one reviews a single change.

## Read this before running: cost

**This spawns many subagents and burns real tokens.** A measured run over
~1,470 lines of new code used **roughly 390,000 subagent tokens** across four
reviewers and three skeptic batches, and took about 20 minutes of wall clock.

That is not a bug — the parallel fan-out and the per-finding refutation are
where the quality comes from. But you are paying for it out of your own plan, so
decide deliberately:

| Diff size | Reviewers | Skeptics | Rough cost |
|---|---|---|---|
| < 100 lines | 1–2 | single vote | ~40–80k |
| 100–500 lines | 2–3 | single vote, 2 on HIGH+ | ~120–200k |
| > 500 lines, or touching auth/payments/data | all 4 | 2–3 on CRITICAL/HIGH | ~300–500k |

**Scale down by default.** If the user has not signalled that they want the full
treatment, ask before running the large configuration, or run the smaller one
and say what you scaled back.

Requires the `Agent` tool. Without it, this skill cannot run — say so rather
than silently doing a single-pass review and presenting it as verified.

## Method

Four phases. The third is the one that matters.

### 1. Resolve scope

Work out the diff from the argument:

- **blank** → current branch vs its merge-base with the default branch:
  `git merge-base HEAD origin/main` (fall back to `origin/master`, then local
  `main`/`master`), then `git diff <base>...HEAD`. If not a git repo, or that
  diff is empty, review the working tree: `git diff HEAD`.
- **`staged`** → `git diff --cached`
- **a number** → GitHub PR: `gh pr diff <n>`
- **anything else** → treat as a base ref and diff `HEAD` against it

Run `git diff --stat` for the file list. **State the resolved scope in one line**
before continuing. If the diff is empty, say so and stop.

If the argument is not a valid ref and there is no diff, do not invent a scope
silently — say what you fell back to and why.

### 2. Fan out reviewers (parallel, one message, multiple Agent calls)

Each is scoped to the changed hunks and the files they touch. They may read
surrounding context but must not review unrelated code.

- **correctness** — logic errors, off-by-one, null/undefined, races, error
  handling, wrong API usage, broken invariants, missed edge cases
- **security** — authz/authn gaps, injection, secrets exposure, unsafe input,
  XSS/CSRF/SSRF, tenant isolation, unsafe defaults — only where the diff
  introduces or touches them
- **perf** — N+1s, unbounded queries or loops, indexes implied by new query
  shapes, needless re-renders, blocking calls on hot paths
- **interaction** — how the change ripples: callers of changed signatures,
  assumptions it breaks elsewhere, migration and rollout ordering, backward
  compatibility, code it leaves unreachable

Findings come back as: severity (CRITICAL/HIGH/MEDIUM/LOW), `file:line`, a
one-line claim, a **concrete failure scenario** (specific inputs or state →
specific wrong output), and a suggested fix.

Instruct every reviewer to prefer **fewer, higher-confidence** findings, anchor
each to a real failure scenario, and skip style unless it causes a defect.

### 3. Adversarially verify every candidate

**Do not skip this. It is the whole point.** For each candidate, spawn an
independent skeptic whose only job is to refute it:

> "Here is a claimed defect: `<finding>`. Prove it is NOT a real bug — show why
> the code is correct, why the triggering input cannot occur, or why the
> framework or caller already handles it. Default to 'not a real bug' unless you
> can construct a concrete failing case."

Drop anything the skeptic refutes. For CRITICAL/HIGH use 2–3 skeptics and keep
the finding only on a majority.

**A finding nobody tried to break is not a finding.** In practice skeptics do
three useful things beyond deleting noise: they correct severity in both
directions, they refute a claim's *mechanism* while confirming the underlying
defect (which changes the fix), and they surface adjacent findings the original
reviewers missed. Report all three.

Where you can verify a claim yourself with a command — read the file, run the
regex, check the deployed header — **do that instead of spending a skeptic.**
Direct evidence beats a second opinion.

### 4. Dedup, rank, report

Merge duplicates by root cause. Report only survivors, most severe first:

**[SEVERITY] `file:line` — claim.** Failure scenario. → Suggested fix.

Then list what was refuted and why — that section is evidence the verification
actually happened, and it is often the most informative part for the reader.

End with: `N candidates → M confirmed (K refuted and dropped)`.

**Do not pad with speculative or unverified items.** A short trustworthy list
beats a long noisy one. If nothing survives, say the diff is clean and list what
you checked.

## Flags

- `--fix` — after reporting, apply the **confirmed** fixes, then run the
  project's typecheck and tests and report the results. Otherwise this is
  read-only; do not modify code.

## Limits

- **Reviews a diff, not a codebase.** For whole-project hardening use
  `gauntlet:harden`.
- **No deterministic gates.** Unlike `gauntlet:harden`, every judgment here comes
  from a model. The refutation pass is the only quality control, which is
  precisely why it is not optional.
- **Cost scales with diff size**, not with how much is wrong. A clean 2,000-line
  diff costs about the same as a broken one.
