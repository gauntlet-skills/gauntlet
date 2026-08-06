# Phase C — First-time user funnel

Can someone who has never seen this app succeed with it? Phase C consistently
produces the highest-value findings in real runs — coachflow's summary recorded
that the biggest issues were **product/flow, not security**.

Steps: **C1** funnel simulation · **C2** launch review · **C3** post-build audit

## C1 — Funnel simulation

Walk the real path a new user takes, screen by screen, reading the code that
renders each one. Not a heuristic review — a simulation.

Build a route map first: landing → signup → verification → onboarding → first
value → habitual use. Then at every step ask what a new user sees when things go
right, when the network fails, and when they have no data yet.

The finding classes that showed up in real runs:

- **The payoff action silently does nothing.** medcomplex's onboarding walked the
  user through adding a medication; it never scheduled, and the dashboard then
  said "no medications." The single worst finding of the entire gauntlet, and
  invisible to every security phase.
- **Blank screen on fetch failure.** An error state that renders nothing reads as
  "your data is gone." Check every screen's failure branch, not just its
  happy path.
- **Fabricated data in the UI.** A chart or ring showing placeholder numbers that
  look real. Users trust it. medcomplex shipped a weekly adherence ring computed
  from nothing.
- **Verification forcing a re-login.** A gratuitous dead end at the exact moment
  of highest drop-off.
- **Client-only gates that bounce-loop.** An onboarding redirect enforced only on
  the client can ping-pong forever.
- **Clinical or jargon-heavy steps before any value is delivered.** Ask for effort
  after the user has seen something work, not before.
- **No privacy reassurance at the moment of sensitive input.** Health, financial,
  or personal data collected with no statement of what happens to it.

## C2 — Launch review

Broader product review: pricing page accuracy against the real plan constants,
empty states, loading states, mobile layout, copy that promises behaviour the
code doesn't have.

**Check every number in user-facing copy against its source constant.** Pricing
pages drift from the plan table, and a wrong limit is a support ticket at best
and a refund at worst.

## C3 — Post-build audit

After C1/C2 fixes land, re-walk the funnel. Same discipline as B3: the fixes
themselves get audited, and the walk is fresh rather than a diff review.

## Gate

Mechanical: `gates/run-gate.sh`.

Judgment — Phase C does not pass until:

- [ ] A route map exists covering signup → first value
- [ ] Every screen's **failure** branch was read, not just its success branch
- [ ] No UI element displays data it cannot actually compute
- [ ] Every user-facing number traced to its source constant
- [ ] The onboarding payoff action verified to actually do the thing
- [ ] C3 re-walk done after fixes
- [ ] Zero CRITICAL, zero HIGH open
