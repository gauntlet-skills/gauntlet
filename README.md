GAUNTLET
Build with AI. Review every change. Prove it's ready to ship. Can be used after the build plugin or on an existing app built without it.

A production-readiness workflow for building with AI

Three free Claude Code skills that turn an AI coding session into a gated development process.

Build → structured implementation with checkpoints
Review → multi-agent review + adversarial verification
Harden → whole-app security, UX, SEO/legal and launch audit

/plugin marketplace add gauntlet-skills/gauntlet
/plugin install gauntlet@gauntlet-skills

```
/gauntlet:build     idea       →  ~16 numbered build prompts, each with a checkpoint
/gauntlet:review    a diff     →  multi-agent review, every finding adversarially verified
/gauntlet:harden    built app  →  A–G audit cascade, each phase behind a gate
```

They compose — build it, review each change, harden before launch — but nothing
requires you to use more than one.

A gate you have not seen fail is not a gate.

AI says "PASS." So what?
Most AI coding workflows ask the model to check its own work.

Gauntlet doesn't.

Every mechanical gate is tested against a known failure. If the gate can't demonstrate that it catches a defect, you don't get to trust the green checkmark.

Best fit: Next.js + Supabase + Stripe + Vercel
Also useful elsewhere: the build/review/gating methodology transfers, but some hardening checks are stack-specific.

Free, MIT, and it runs entirely inside your own Claude session — no service to
sign up for, no API key, no per-run cost beyond your own plan.

## Install

Works in **Claude Code** and **Codex CLI** from the same repo — one shared skills
tree, one manifest per host.

**Claude Code**

```
/plugin marketplace add gauntlet-skills/gauntlet
/plugin install gauntlet@gauntlet-skills
```

If the summary says `Run /reload-plugins to activate.`, run that. Then
`/gauntlet:build`, `/gauntlet:review`, or `/gauntlet:harden` — or just describe
the task and Claude picks.

**Codex CLI**

```bash
codex plugin marketplace add https://github.com/gauntlet-skills/gauntlet
codex plugin add gauntlet@gauntlet-skills
```

Then type `$` and pick `build`, `review`, or `harden`.

<details>
<summary>Using Cowork, cloud sessions, or routines?</summary>

A plugin enabled only in your user settings doesn't transfer to those. For cloud
sessions, declare it in the repository's `.claude/settings.json` so it installs
at session start. For Cowork, enable the skill for your claude.ai account. Local
Claude Code needs none of this.
</details>

## Start here

New to this? Read
[`QUICKSTART.md`](plugins/gauntlet/skills/build/QUICKSTART.md) — five steps end
to end, written for someone who has never done it. Never used a terminal?
[`cli-basics.md`](plugins/gauntlet/skills/build/reference/cli-basics.md) covers
what a CLI is and the five you'll touch. Then look at
[`example/BUILD.md`](plugins/gauntlet/skills/build/example/BUILD.md), a complete
worked example you can copy the shape of.

## Who this is for

**Someone shipping a real app with an AI coding agent, who has to answer "is this
safe to put in front of users?" and doesn't have a security team.**

Concretely, it fits if you are:

- A solo founder or small team building on Next.js + Supabase + Stripe
- Using Claude Code or Codex to write most of the code
- At the point where the app works and the question has shifted from "does it
  run" to "will this hurt someone"
- Non-technical or newly technical — `QUICKSTART.md` assumes no prior terminal
  experience, and `reference/cli-basics.md` starts from what a CLI even is

It fits less well if you have a dedicated security function, a stack far from the
one above, or a codebase nobody built with an agent. The gate discipline still
transfers; the specific checks assume that stack.

## How it works

Three skills, loaded on demand. Only each skill's one-line description sits in
your session (~526 tokens total); the phase files, the 144-item rubric, and the
gate scripts load **only when you actually invoke one**.

Two kinds of check, deliberately separated:

**Mechanical gates** are scripts with exit codes — typecheck, lint, tests, build,
secret scan, HTTP header audit. They distinguish **three** states, not two:

```
0  ran, found nothing
1  ran, found something
2  COULD NOT RUN — broken, and never reported as clean
```

That third state is the whole design. Collapsing it into `0` is how a scanner
reports success having never executed.

**Judgment checks** are the audit findings — things no script can decide. Those
get a different discipline: every claim names the file it was verified against,
and each phase document carries a "What PASSES — verified, not assumed" section
where a line without a filename does not belong.

Each phase ends at a gate. CRITICAL and HIGH block; MEDIUM and LOW are recorded
and may be deferred **with a written reason**, never silently.

## Which one do I run?

| Situation | Skill |
|---|---|
| An idea, no code yet | **build** |
| A branch or PR to check before merging | **review** |
| A working app, heading for launch | **harden** |
| Just deployed | **harden**, Phase G |

### review vs harden — they are not the same tool

This is the distinction people get wrong, and it costs them.

**review** is diff-scoped. It is a from-scratch approximation of a cloud
"ultrareview": parallel reviewers over correctness, security, performance and
interaction, then skeptics that try to *refute* every finding before it is
reported. It is excellent at "is this change correct" and it runs on every branch.

**It structurally cannot tell you whether your app is safe to launch**, because
it only ever sees the diff. Unless the following are literally in your changed
lines, a diff reviewer will never look at them:

- Whole-app RLS posture — is row-level security on **all** 40 tables, or 38
- Tenant isolation across every route, not the three you touched
- Missing indexes implied by query shapes elsewhere in the schema
- Environment and documentation drift — a var added months ago, never documented
- Whether a first-time user can actually complete signup and reach value
- Whether your CI has ever run
- Headers on the deployed origin, which appear in no source file at all

**harden** is whole-codebase and launch-scoped. Phase B audits security across
the app, Phase C simulates the first-time user funnel, Phase E produces a
readiness verdict separating code blockers from operator blockers, Phase G checks
the thing actually serving users.

Use both. They catch different classes of defect, and neither substitutes for the
other.

### review vs your host's built-in review

Claude Code now ships `/code-review`, with effort levels and a cloud multi-agent
mode. On Claude Code it is a fine default for routine diffs. `/gauntlet:review`
is still the right choice when you are on **Codex** or another host without a
built-in review, when the code **must not leave your session**, when you want to
set the reviewer dimensions and skeptic votes yourself, or when you want a second
review not anchored on the first.

Neither one answers the launch question. A clean diff review, from any tool,
means the change is sound, not that the app is ready. That is what **harden** is for.

## What makes this different

Most build checklists are somebody's opinion. This one comes from running the
same process across six real projects and writing down what it found.

**Every gate has been proven able to fail.** That sounds obvious and isn't. One
of these projects had a secret scanner that printed `OK: No hardcoded secrets
found` for the entire life of the repository and had *never once executed* — a
swallowed error meant "did not run" and "found nothing" shared an exit code. It
passed a planted live key. Nobody caught it by reading the script.

So every gate here distinguishes three states, not two: ran-and-clean,
ran-and-found-something, and **could not run**. Each ships with a canary test
that plants the defect and watches the gate go red. If you write your own gate,
`gates/GATES.md` explains why you should do the same.

**The findings are real.**
[`known-patterns.md`](plugins/gauntlet/skills/harden/references/known-patterns.md)
is a list of defects that were live in projects that had already passed
something: a lockout that permanently locked users out, an onboarding flow whose
payoff action silently did nothing, `unsafe-eval` shipped to production on a
health-data app that had passed five audit phases, CI that watched the wrong
branch and had never run.

## What's inside

**`/gauntlet:build`**

- The fixed phase sequence — core 1–7, one prompt per feature (cap 8), then the tail
- The 12 real per-phase prompt specs the generator uses
- The 16 standing rules that go into your `CLAUDE.md`
- The four during-build spot checks, placed inline where they apply
- `gates/lint-buildplan.mjs` — validates a `BUILD.md`'s structure

**`/gauntlet:review`**

- Parallel reviewers across correctness, security, performance, interaction
- A skeptic pass that tries to *refute* every finding — what survives is what
  could not be broken
- **Expensive by design.** A measured run over ~1,470 lines used roughly 390k
  subagent tokens. It scales down for small diffs; the skill says how.

**`/gauntlet:harden`**

- Seven phase files: payments & data, security, UX funnel, SEO & legal,
  pre-launch, store submission, post-deploy
- The full analyzer rubric — 144 web items / 8 categories, 162 mobile / 11
- `gates/run-gate.sh` — the mechanical gate
- `gates/check-headers.mjs` — audits the deployed HTTP surface, which is the only
  place platform-injected headers are visible. `--expect <file>` compares the
  live headers with a committed policy, to catch drift between the repo and a CDN
  rule or host dashboard. `gates/canary-headers.mjs` proves it can fail
- `gates/GATES.md` — why a gate you have not seen fail is not a gate

## Honest limits

- **Phases A–E are grounded in completed runs. F and G are not.** Store
  submission has been written but never run end to end; post-deploy has never
  completed anywhere. Both files say so at the top.
- **The stack is opinionated** — Next.js, Supabase, Stripe, Vercel. The phase
  structure and the gate doctrine transfer anywhere; the specific checks assume
  that stack. One outside team ran it on Supabase + Cloudflare Workers + Vite
  SPAs built with Lovable; what they had to adapt is now in B6 (where headers
  live per hosting model) and in the build skill (rules for builders that never
  read `CLAUDE.md`).
- **The rubric grades a spec, not compiled code.** It is a checklist for a
  reviewer, not a static analyser.
- **Nothing here replaces a professional audit** for a regulated product.

## Verifying what you got

Parts of the rubric and the build specs are generated from source that does not
ship here. Each generated file carries a `<!-- source-sha256: … -->` comment, and
each directory has a `MANIFEST.json`:

```
node plugins/gauntlet/skills/harden/gates/check-extracted.mjs
node plugins/gauntlet/skills/build/gates/check-extracted.mjs
```

That confirms the files have not been edited since generation. It is
tamper-evidence, not proof of provenance — someone who edits a file and updates
the manifest defeats it.

## License

MIT. See [LICENSE](LICENSE).
