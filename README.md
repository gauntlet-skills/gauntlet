# Gauntlet

Two skills for building a production-grade app with an AI coding agent, and then
proving it is actually ready for users.

```
/gauntlet:build     spec  →  ~16 numbered build prompts, each with a checkpoint
/gauntlet:harden    built app  →  A–G audit cascade, each phase behind a gate
```

Free, MIT, and it runs entirely inside your own Claude session — no service to
sign up for, no API key, no per-run cost beyond your own plan.

## Install

```
/plugin marketplace add user2922/gauntlet-skills
/plugin install gauntlet@gauntlet-skills
```

If the install summary says `Run /reload-plugins to activate.`, run that.

## Start here

New to this? Read
[`QUICKSTART.md`](plugins/gauntlet/skills/build/QUICKSTART.md) — five steps end
to end, written for someone who has never done it. Then look at
[`example/BUILD.md`](plugins/gauntlet/skills/build/example/BUILD.md), a complete
worked example you can copy the shape of.

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

**`/gauntlet:harden`**

- Seven phase files: payments & data, security, UX funnel, SEO & legal,
  pre-launch, store submission, post-deploy
- The full analyzer rubric — 144 web items / 8 categories, 162 mobile / 11
- `gates/run-gate.sh` — the mechanical gate
- `gates/check-headers.mjs` — audits the deployed HTTP surface, which is the only
  place platform-injected headers are visible
- `gates/GATES.md` — why a gate you have not seen fail is not a gate

## Honest limits

- **Phases A–E are grounded in completed runs. F and G are not.** Store
  submission has been written but never run end to end; post-deploy has never
  completed anywhere. Both files say so at the top.
- **The stack is opinionated** — Next.js, Supabase, Stripe, Vercel. The phase
  structure and the gate doctrine transfer anywhere; the specific checks assume
  that stack.
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
