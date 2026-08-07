# Testing this before it goes public

Thanks for trying it. This is unreleased — the repo is private and you have
access because you were added as a collaborator.

**What would help most: tell me where you got stuck or confused.** Bugs are
useful, but "I didn't know what to type next" is more useful. The whole point is
that someone who hasn't built a production app before can use this, and I can't
see my own blind spots.

## Install

The repo is private, so you need your GitHub CLI logged in first:

```bash
gh auth status        # should show you're logged in
```

Then in Claude Code:

```
/plugin marketplace add user2922/gauntlet-skills
/plugin install gauntlet@gauntlet-skills
```

If the summary says `Run /reload-plugins to activate.`, run that.

Check it worked:

```
/plugin list
```

You should see `gauntlet@gauntlet-skills` enabled with 3 skills.

## What you get

Three commands, each independent — you don't have to use all three:

```
/gauntlet:build     an idea      →  ~16 numbered build prompts with checkpoints
/gauntlet:review    a diff       →  multi-agent code review, findings verified
/gauntlet:harden    a built app  →  A–G pre-launch audit
```

## Pick a path

**If you have an idea but no code** — start with `/gauntlet:build`. Read
`QUICKSTART.md` first; it's written for someone who's never done this. If you've
never used a terminal, `reference/cli-basics.md` comes before that.

**If you have an app already** — `/gauntlet:harden`, then say "run Phase A".
This is the path most likely to find something real, because it audits code that
already exists.

**If you just want to see it work** — `/gauntlet:review` on any branch with
changes. Read the cost note first (below).

## ⚠️ Cost warning on `/gauntlet:review`

This one is genuinely expensive. It spawns many subagents in parallel — a
measured run over ~1,470 lines used **roughly 390,000 tokens** and took about 20
minutes.

**That comes out of your Claude plan, not mine.** For a small diff it scales
down a lot (~40–80k), and the skill has a sizing table. But please don't point
it at a 5,000-line diff without meaning to.

`/gauntlet:build` and `/gauntlet:harden` are normal-cost.

## What I'd love to know

Rough order of usefulness:

1. **Where did you get stuck or have to guess?** Any moment where you didn't
   know what to type, or the instructions assumed something you didn't have.
2. **Did a checkpoint make sense?** They're meant to be verifiable by looking. If
   one was vague or you couldn't tell whether it passed, that's a bug.
3. **Did an audit find something real?** Or was it noise? Both are worth knowing —
   a gate that cries wolf gets switched off, which is worse than no gate.
4. **Did anything crash, hang, or error?** Paste the whole error.
5. **Did the cost surprise you?** Especially on `review`.

## Known rough edges

I'd rather tell you than have you find them:

- **Phases F (app store) and G (post-deploy) are drafts.** F was written but never
  run end to end; G has never completed anywhere. Both files say so at the top.
- **Opinionated stack** — Next.js, Supabase, Stripe, Vercel. The phase structure
  and gate ideas transfer anywhere; the specific checks assume that stack.
- **Windows/Git Bash path weirdness.** If a command fails with a path like
  `C:/Program Files/Git/...` you never typed, prefix it with
  `MSYS_NO_PATHCONV=1`.
- **`/gauntlet:review` needs the Agent tool.** If your setup doesn't have it, the
  skill should say so rather than silently doing a worse review — if it doesn't,
  that's a bug worth reporting.
- **The rubric grades a spec, not compiled code.** It's a reviewer's checklist,
  not a static analyser.

## Reporting back

Whatever's easiest — a message, or open an issue on the repo. For a bug, the
useful shape is:

```
What I ran:        /gauntlet:harden, Phase B
What I expected:   a list of findings
What happened:     <paste, including the whole error>
Project:           Next.js 15 / Supabase / no payments
OS:                macOS 15 / Windows 11
```

No need to be polite about it. "This was confusing and I gave up" is the single
most valuable thing you can send me.
