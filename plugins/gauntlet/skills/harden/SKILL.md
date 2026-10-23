---
name: harden
description: Run the A–G pre-launch hardening gauntlet on a project — a phased audit-fix-verify cascade covering payments, security, UX funnel, SEO/legal, pre-launch verification, mobile store submission, and post-deploy checks. Every phase ends at a gate that must be proven able to fail. Use when the user says "gauntlet", "launch review", "pre-launch audit", "harden this before launch", "is this ready to ship", or names a phase directly (A1, B1, B3, C2, C3, D1, E1, E4, F, G).
license: MIT
---

# The Launch Gauntlet

A phased hardening process for taking a project from "it works" to "it can face
real users and real money." The phases were derived from full runs on four
real production projects. `references/known-patterns.md` adds defects from two
more (six in all) and from one outside team's production stack.

Companion skill: the **build** skill produces the numbered build prompts that
get you a working app. This one starts where that finishes.

> Invocation differs by host: Claude Code uses `/gauntlet:<skill>`, Codex uses
> `$<skill>`. Skill names below are given host-neutral.

**The load-bearing idea is the gate, not the checklist.** Any audit can produce a
document that says PASS. A gate is only worth something if you have watched it
FAIL. Read `gates/GATES.md` before running any phase — it is short and it is the
part people skip.

## Phase map

| Phase | What it answers | Steps | Read |
|---|---|---|---|
| **A** | Do money and data move correctly? | A1 payments · A2 data access · A3 env/secrets · A4 ASO | `phases/A-payments-data.md` |
| **B** | Can it be attacked? | B1 audit → B2 fix → B3 reaudit → B4 hardening → B6 domain | `phases/B-security.md` |
| **C** | Can a first-time user succeed? | C1 funnel · C2 launch review · C3 post-build audit | `phases/C-ux-funnel.md` |
| **D** | Is it findable and lawful? | D1 SEO · D2 images · D3 legal · D4 cookies | `phases/D-seo-legal.md` |
| **E** | Is it actually ready? | E1 checklist · E2 deps · E3 gap sweep · E4 verdict | `phases/E-prelaunch.md` |
| **F** | Will the stores accept it? | Store presubmission | `phases/F-mobile.md` |
| **G** | Did it survive contact? | Post-deploy verification | `phases/G-postdeploy.md` |

**Load one phase file at a time.** Do not read all seven — each is self-contained
and reading ahead wastes context on phases you may never run.

## Applicability — decide this first

Skipping a phase is a decision that gets recorded, not a silent omission.

- **Web-only project** → A4 and F are **N/A**. Say so explicitly in the phase
  record; do not leave them blank.
- **No payments** → A1 is N/A.
- **Not deployed yet** → G is **BLOCKED**, not N/A. It runs after go-live.
- **Everything else runs.** "We don't have users yet" is not a reason to skip C.

## The loop

Every phase runs the same sequence, which mirrors the build: build → checkpoint
→ fix blockers → commit on a branch → merge → push.

1. **Run the phase audit.** Read actual code and actual command output. Never
   grade from memory, from the spec, or from what a previous phase claimed.
2. **Write the phase document** to `docs/` before fixing anything. The audit
   record must survive the fix — a finding you fix and never wrote down is a
   lesson you will re-learn.
3. **Run the gate** (`gates/run-gate.sh`). CRITICAL and HIGH findings block.
   MEDIUM and LOW are recorded and may be deferred with a stated reason.
4. **Fix blockers**, then re-run the gate. A phase is not done because the fixes
   are written; it is done because the gate passed after them.
5. **Commit on a branch, merge, push.**

## Known patterns

`references/known-patterns.md` — defects found in real runs across six projects,
grouped by surface. Every entry was live in something that had already passed
something.

**Read it before your first phase.** It is faster than rediscovering them, and
several are invisible to the phase they logically belong to — the wildcard CORS
header is in no source file, and the onboarding action that silently did nothing
was found by no security check.

## Non-negotiables

These come from failures in real runs. Each one cost something.

- **Verify, don't assume.** Every phase document has a "What PASSES — verified,
  not assumed" section. If you did not read the code or run the command, it does
  not go in that section.
- **A gate you have not seen fail is not a gate.** One project's secret scanner
  reported OK for the life of the repo — a swallowed `git grep` error made it
  pass unconditionally, including against a planted live key. See
  `gates/GATES.md`.
- **Proxy signals cause phantom bugs.** Grepping source for a pattern is not the
  same as reading the output. Read the real result first.
- **Check CI has ever run.** `gh run list` returning empty means never, not
  passing. One project's workflow watched `main` while the branch was `master`.
- **Apply every intermediate migration at cutover**, not just the newest. Deployed
  code queries columns from migrations in the middle of the stack.
- **Never `npm audit fix --force`.** It breaks transitive deps. Targeted patch
  bumps only.

## The rubric

`references/rubric-web.md` (144 items, 8 categories, 27 Critical) and
`references/rubric-mobile.md` (162 items, 11 categories, 4 Critical) are the
item-level checklists. Where a phase file says *what* to audit, the rubric says
*exactly which things to check*.

It cuts across phases rather than mapping to one, so load the categories the
phase you are running needs:

| Phase | Web categories | Mobile categories |
|---|---|---|
| **A** payments & data | 2 Stripe · 1 Auth | 4 RevenueCat · 3 RLS · 1 Auth |
| **B** security | 1 Auth · 6 AI security · 4 Infrastructure | 1 Auth · 2 Edge functions · 3 RLS · 6 Health data |
| **C** UX funnel | 7 Design craft · 8 Retention | 10 Design craft · 11 Retention |
| **D** SEO & legal | 3 Legal compliance | 5 Store compliance · 6 Health data |
| **E** pre-launch | 5 Testing & CI · 4 Infrastructure | 8 Testing & CI · 7 Monitoring · 9 Build |
| **F** store submission | — | 5 Store compliance · 9 Build |

Grading mechanics, N/A discipline, and expected scores are in the header of each
rubric file. The short version: a `[Critical]` miss fails its whole category,
"not implemented" is FAIL and never N/A, and a fresh scaffold scoring in the
50s–60s is normal — aim for ~90, not 100.

## Output contract

Every phase produces one markdown file under `docs/`. Format and finding-ID
scheme: `references/finding-format.md`. Do not invent a new layout per phase —
the consistency is what makes a later phase able to cross-reference an earlier
one.
