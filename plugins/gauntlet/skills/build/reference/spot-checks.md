# During-build spot checks

Small audits placed **inline, immediately under the prompt they apply to**. Run
at the moment they apply, not batched at the end.

They are cheap when inline and expensive when retrofitted, because a defect
introduced in Prompt 2 has had ten prompts of code built on top of it by the time
a post-build audit finds it.

> Label these "Spot check after Prompt N", not "A1–A4". The **harden** skill has
> its own Phase A with steps A1–A4 covering overlapping ground, and the shared
> lettering causes real confusion about which sequence is meant.

## After the project-setup prompt — environment & secrets

- Anything sensitive behind a `NEXT_PUBLIC_` prefix moved server-side. That
  prefix means "bundled to the browser," and it is the most common way a key
  ships to production in a client bundle.
- `.env.example` bucketed REQUIRED / FEATURE / OPTIONAL, placeholders only.
- The secret scanner runs, **and has been proven able to fail.** Plant a
  key-shaped string, watch it go red, remove it. A scanner nobody has seen fail
  is decoration — see the harden skill's `gates/GATES.md`.
- The scanner distinguishes "clean" from "did not run." If it scans build output,
  it must not report a pass when that output is absent.

## After the schema prompt — connection pooling

- Transaction pool mode for the app, direct connection for migrations only.
  Serverless functions exhaust a direct connection pool under trivial load.
- Skip only if the stack talks HTTP to the database rather than raw Postgres —
  and write down that it was skipped and why.

## After the first data-returning routes — data access

The highest-value spot check in the set.

- Every endpoint filters by the authenticated user id derived from the session,
  never from a request parameter.
- Try it: as user A, request user B's row by UUID. Zero rows, not a row.
- An ownership failure returns **404, not 403** — a 403 confirms the resource
  exists, which is itself a disclosure.
- Row-level security is enabled on every table created so far. Count them.

## After the payments prompt — payment integration

- Idempotency keys on outbound charge and checkout calls.
- Webhook signature verified against the **raw body**. Parsing JSON first breaks
  the signature.
- Idempotency on inbound: insert the event id *before* processing, so a retry
  collides on the insert. Read-then-process leaves a window.
- Every event type the flow depends on is handled. A missing `invoice.paid` is a
  silent revenue bug — one real build had exactly this, found only on retrofit.
- Test cards run: success, decline, insufficient funds, and a 3DS challenge.

## How to place them in the document

Directly under the prompt they follow, before the next prompt:

```markdown
### Checkpoint 2a
- [ ] ...

> **Spot check — environment & secrets.** Before Prompt 2b:
> - [ ] No sensitive value behind `NEXT_PUBLIC_`
> - [ ] `.env.example` bucketed, placeholders only
> - [ ] Secret scanner canary-verified: planted a key, saw it fail, removed it

## Prompt 2b — Security utilities
```

Blockquote them so they read as a distinct interruption rather than as part of
the next prompt.
