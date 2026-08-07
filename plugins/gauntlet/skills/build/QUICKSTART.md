# Quickstart

You have an app idea. You want a real, production-grade app — not a demo. This is
the shortest path, start to finish.

Assumed: Claude Code installed, a terminal, and about an hour of your attention
spread across a few days. **No prior experience required.** You will not be asked
to write code.

Never used a terminal, or unsure what `npm` or `gh` are? Read
[`reference/cli-basics.md`](reference/cli-basics.md) first — it covers what a CLI
is, the five you'll touch (node/npm, git, gh, vercel, supabase), and the three
rules for handling keys. Ten minutes, and it removes most of what goes wrong.

---

## Step 0 — Say this

Open Claude Code in an empty folder and type:

```
Use the gauntlet-build skill. I want to build: <one paragraph describing your app>

Who it's for: <who>
What they can do: <the 3–5 things a user can actually do>
What I charge: <free / one price / tiers — or "decide for me">
```

That's it. That is the whole first step.

**Write the paragraph like you're describing it to a friend.** Not a spec, not
jargon. "A tool where dog walkers can log walks and send clients a photo summary
at the end of the week" is a better input than three paragraphs of feature
bullets.

## Step 1 — Answer the questions

Claude will ask you things. Some will feel obvious, some won't. The ones that
matter most:

- **What has to be true for someone to pay you?** This decides your tier limits.
- **What's the one thing a new user must succeed at?** This becomes the
  onboarding, and it is the single most common thing to get wrong.
- **Does anything need AI?** If not, say no — it keeps the app simpler and
  cheaper. Do not add AI because it seems expected.

Then it writes three files: **`BUILD.md`** (your numbered prompts),
**`CLAUDE.md`** (rules the agent re-reads every session), and **`SPEC.md`**.

Check `BUILD.md` looks like `example/BUILD.md` in this skill. If it does, you're
on track.

## Step 2 — Run the prompts, one at a time

Open `BUILD.md`. Copy the first fenced block. Paste it into Claude Code. Wait.

When it finishes, find the `### Checkpoint 1` list underneath and **actually check
each item.** Type the commands. Look at the output. Do not skip this — the
checkpoint is the only thing standing between you and discovering in week three
that prompt 4 built on a broken prompt 3.

If a checkpoint item fails, say so:

```
Checkpoint 3, item 2 failed: `npm run typecheck` reported 4 errors. Fix them.
```

Then re-check. Only when every item passes do you move to the next prompt.

**Repeat about sixteen times.** That's the build.

> **Do not paste two prompts at once.** It is the single most common way this
> goes wrong. Each prompt assumes the previous one finished and was verified.

## Step 3 — Get the keys when you're asked for them

`BUILD.md` ends with a table of services and the prompt that first needs each
one. You do not need them all on day one — get each as you reach it.

When a prompt needs a key you don't have, it will say so. Go get it, put it in
`.env.local`, keep going. **Never paste a key into the chat.**

## Step 4 — Harden it

When the last checkpoint passes, you have a working app. It is not yet an app you
should point strangers at.

```
Use the gauntlet-harden skill. Run Phase A on this project.
```

That runs the A–G cascade: payments and data, security, the first-time user
funnel, SEO and legal, pre-launch verification, then post-deploy. Each phase ends
at a gate that has to pass before the next one starts.

Expect it to find things. Every real first-run audit in this project's evidence
base found something. An audit that finds nothing has not been run properly.

## Step 5 — Ship

Phase E gives you a readiness verdict separating **code blockers** from
**operator blockers** — the second list is usually DNS, environment variables,
and key rotation rather than anything you have to build.

Do those, deploy, then run Phase G against the live site. G is the only phase that
checks the thing actually serving users.

---

## What to do when it goes wrong

**A prompt produces something that doesn't match its checkpoint.** Say exactly
which item failed and what you saw. Don't say "it's broken."

**The agent starts changing things you didn't ask about.** Stop it. Say: "Only do
what prompt N asks. Revert anything else."

**You lose the thread across sessions.** `CLAUDE.md` exists for this — the agent
re-reads it every session. If it has drifted, say "re-read CLAUDE.md."

**Something feels wrong but you can't say why.** Ask: "What did you just change,
and why?" You are allowed to not understand the code. You are not allowed to skip
the checkpoints.

## The two rules

1. **One prompt at a time.**
2. **Never skip a checkpoint.**

Everything else is recoverable.
