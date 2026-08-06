# Gates

A gate is a check that can stop the process. The whole value of the gauntlet
rests on the gates being real. A gate that cannot fail is worse than no gate,
because it manufactures confidence.

## The failure this doctrine exists to prevent

medcomplex-pro's `scripts/check-secrets.sh` printed `OK: No hardcoded secrets
found` and exited 0 for the entire life of the repository.

The excludes array was double-quoted, so bash did not strip the backslash from
`\!`. git received a literal `":\!scripts/..."` pathspec and rejected it with a
fatal error. That fatal went to stderr, which was piped to `/dev/null`. `git
grep` exited non-zero, which the script read as "no matches found."

It passed a **planted live key**. It had never once run.

Nobody caught it by reading the script. It was caught by planting a canary.

## The three properties every gate must have

**1. It fails on a planted defect.**
Before trusting any gate, plant the thing it is supposed to catch and watch it
go red. If you cannot make it fail, you have not verified it — you have read it.
Reading is not verification; that is the entire lesson above.

**2. It distinguishes "clean" from "did not run."**
These are the same observable outcome (no findings) and opposite realities. Every
gate needs a self-test that proves the machinery works before it is allowed to
report a pass. `check-secrets.sh` does this by scanning for a string known to
exist in tracked files and refusing to report a pass if that comes back empty.

**3. Its error path is not the same as its pass path.**
Distinguish three exit states, never two:

| Exit | Meaning |
|---|---|
| `0` | Ran, found nothing |
| `1` | Ran, found something — the gate fired |
| `2` | Could not run — broken, not clean |

Collapsing 2 into 0 is exactly how the secret scanner failed. Never `2>/dev/null`
on a check whose silence you intend to interpret.

## Canary tests are permanent, not one-off

Once you have proven a gate fails, keep the proof. A canary test that lives in the
test suite prevents the gate from silently rotting when someone edits it later.
medcomplex has `tests/unit/check-secrets.test.ts` holding deliberately key-shaped
strings; the scanner excludes that file by path so the canary does not trip the
real scan.

Pattern:

```
1. Gate script excludes the canary file by path (and excludes itself).
2. Canary test invokes the gate against known-bad content.
3. Canary test asserts non-zero exit AND the expected message.
4. Canary test also asserts exit 0 on known-good content.
```

Step 4 matters as much as step 3. A gate that fails on everything is also broken;
it just gets disabled instead of trusted.

## Two kinds of gate

**Mechanical** — a command with an exit code. Typecheck, lint, tests, build,
secret scan, coverage floor. Run these with `run-gate.sh`. They are cheap,
deterministic, and should run at every phase boundary, not just at E.

**Judgment** — a human or model reading code against criteria. Every finding in a
phase audit. These cannot be scripted, so they get a different discipline:

- Every claim in a "What PASSES" section names the file and what was checked.
- "No findings" is only acceptable alongside evidence of where you looked.
- A judgment gate that produces zero findings on first run is itself suspect.
  Every real first-run audit in the evidence base found something.

## Severity and what blocks

| Severity | Blocks the phase? |
|---|---|
| CRITICAL | Yes. Stop, fix, re-gate. |
| HIGH | Yes. |
| MEDIUM | No — recorded, may be deferred with a written reason. |
| LOW | No — recorded, carried forward to the phase record. |

Deferral is a decision with a name attached and a reason written down, never a
silent omission. Carried-forward LOWs get re-listed in the next phase document so
they do not evaporate.

## Beware the tool that agrees with you

Static scanners built on regex-over-source, with no AST and no cross-file
resolution, cannot see that a named helper implements the check they are looking
for. Run against a mature codebase they produce near-total false positives; the
tempting response is to relax the rules until the noise stops, at which point the
gate no longer fires on anything.

If a scanner reports many findings, verify a sample against the actual code
**before** acting on any of them, and before tuning it. A gate tuned to be quiet
is a gate that has been disabled slowly.
