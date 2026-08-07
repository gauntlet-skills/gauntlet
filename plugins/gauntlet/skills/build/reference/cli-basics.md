# Terminals and CLIs, for people who haven't used them

You will hit instructions like `npm run typecheck` or `gh repo create`. If that
looks like nonsense, this page is for you. Nothing here is hard — it is just
unfamiliar.

## What a terminal is

A window where you type commands instead of clicking. That's the whole idea.
Clicking "New Folder" in Explorer and typing `mkdir photos` do the same thing.

Windows has a few. Any of them work:

- **PowerShell** — the default. Start menu → type "PowerShell".
- **Git Bash** — comes with Git. Uses forward slashes and Mac/Linux-style
  commands, which is what most tutorials assume.
- **The terminal inside VS Code** — the same thing, docked next to your code.

Claude Code runs commands for you in one of these. You will still want your own
open sometimes, to check something yourself.

**Three things worth knowing:**

- You are always "in" a folder. `cd myproject` moves in, `cd ..` moves up, and
  `pwd` (Git Bash) or `pwd` / `cd` (PowerShell) says where you are.
- A command that prints nothing usually **worked**. Silence is success. Errors
  are loud.
- Up-arrow recalls your last command. You will use this constantly.

## What a CLI is

A **CLI** — command-line interface — is a program you run by typing rather than
clicking. Most services you'll use have both a website and a CLI that does the
same things.

The website is better for looking around. The CLI is better when you want to do
the same thing repeatedly, or when you want Claude to do it for you — Claude can
run a CLI, it can't click a button on a website.

You install one once and then it's just a word you type.

## The ones this build uses

### `node` and `npm` — runs your app

Node runs JavaScript on your computer. npm installs the libraries your app
depends on. These come together; install Node and you have both.

```bash
node --version      # confirm it's installed
npm install         # download everything this project needs
npm run dev         # start the app locally, usually at localhost:3000
npm run typecheck   # ask "did I break anything?" without running it
```

`npm run <something>` runs a shortcut defined in your project's `package.json`.
When a checkpoint says "run `npm run typecheck`", that's what it means.

**Install:** [nodejs.org](https://nodejs.org) — take the LTS version.

### `git` — remembers every version of your code

Git records snapshots so you can go back. **This is your undo button for
everything**, and it is the single most valuable thing on this page. If Claude
changes fifty files and breaks the app, git is how you get back.

```bash
git status                 # what changed since the last snapshot
git add -A                 # stage everything
git commit -m "message"    # take the snapshot
git log --oneline          # list snapshots
```

Commit after every checkpoint passes. Cheap to do, painful to have skipped.

**Install:** [git-scm.com](https://git-scm.com) — this also gives you Git Bash.

### `gh` — GitHub from the terminal

GitHub stores your code online. `gh` is its CLI.

```bash
gh auth login                                  # once, connects to your account
gh repo create my-app --private --source=. --push
gh run list                                    # did my automated checks run?
```

That last one matters more than it looks. **An empty result means your checks
have never run** — which looks exactly like them passing. One project here had a
config watching the wrong branch, so its checks had never executed once; turning
them on immediately found five real bugs.

**Install:** [cli.github.com](https://cli.github.com)

### `vercel` — puts your app on the internet

Vercel hosts your app. Usually you connect it to GitHub once and every push
deploys automatically, so you may barely touch the CLI.

```bash
vercel login
vercel link          # connect this folder to a Vercel project
vercel env pull      # download the project's settings into .env.local
vercel --prod        # deploy right now
```

**One thing that catches everyone:** environment variables marked *sensitive* in
Vercel are **write-only**. Once saved, neither the dashboard nor the CLI can show
you the value again. Save every key to a password manager when you create it, or
you will be regenerating it later.

**Install:** `npm i -g vercel`

### `supabase` — your database

Supabase is your database, login system, and file storage. The CLI mainly
applies *migrations* — files describing changes to your database structure.

```bash
supabase login
supabase link --project-ref <ref>   # ref is in your project's URL
supabase db push                    # apply migrations
```

**Apply every migration, not just the newest.** Deployed code often reads columns
added by a migration in the middle of the stack. Skipping one produces a 500
error on a single page that looks like a code bug and isn't.

**Install:** [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)

### `claude` — Claude Code itself

```bash
claude                     # start a session in the current folder
claude plugin list         # what plugins you have
```

## Keys and secrets

Every service above gives you keys — long random strings proving you're you.

**Three rules, and they matter more than anything else here:**

1. **A key goes in `.env.local`, never in your code.** Code gets committed to
   GitHub; `.env.local` is deliberately ignored.
2. **Never paste a key into a chat**, including with Claude. It doesn't need to
   see them.
3. **A key that has been somewhere public is burned.** Rotate it — generate a new
   one and delete the old. Deleting the message isn't enough.

A key committed to git stays in the history even after you delete the file.

## When something goes wrong

**"command not found"** — not installed, or installed but your terminal doesn't
know yet. Close the terminal and open a new one first; that fixes it about half
the time.

**A wall of red text** — read the *first* few lines, not the last. The real error
is usually at the top and the rest is where it happened.

**Windows path weirdness in Git Bash** — Git Bash sometimes rewrites `/something`
into a Windows path. If a command fails with a path like
`C:/Program Files/Git/...` that you never typed, prefix the command with
`MSYS_NO_PATHCONV=1`.

**You genuinely don't know** — paste the whole error to Claude and say what you
were doing. That is a completely reasonable move and it is faster than guessing.

## What you actually need to know

You don't need to learn the terminal. You need six commands:

```bash
npm run dev        # see the app
npm run typecheck  # did I break it
git status         # what changed
git add -A && git commit -m "..."   # save a snapshot
git log --oneline  # what have I saved
```

Everything else you can look up, or ask for, when a checkpoint asks for it.
