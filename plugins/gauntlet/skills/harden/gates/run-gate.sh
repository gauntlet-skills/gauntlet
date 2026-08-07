#!/usr/bin/env bash
# Mechanical gate for the launch gauntlet.
#
# Runs the deterministic checks a phase boundary requires and prints a result
# table. Project-agnostic: it discovers which checks apply from package.json
# rather than assuming a fixed script set.
#
# Exit codes (see gates/GATES.md — never collapse these into two):
#   0  all applicable checks passed
#   1  at least one check FAILED  — the gate fired
#   2  the gate could not run     — broken, NOT clean
#
# Usage:
#   run-gate.sh [project-dir]        # default: cwd
#   run-gate.sh --list               # show which checks would run, run nothing
#
set -uo pipefail

# ${ARR[@]+"${ARR[@]}"} rather than "${ARR[@]}" throughout: under `set -u`,
# bash <= 4.3 treats an EMPTY array as unset and aborts. Stock macOS ships
# bash 3.2, and the empty case here is the all-green path (every candidate
# script defined, nothing skipped) — so the failure would land precisely on a
# passing run, exiting non-zero and reading as GATE FAILED.

PROJECT_DIR="."
LIST_ONLY=0
for arg in ${@+"$@"}; do
  case "$arg" in
    --list) LIST_ONLY=1 ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) PROJECT_DIR="$arg" ;;
  esac
done

cd "$PROJECT_DIR" 2>/dev/null || { echo "ERROR: cannot cd to '$PROJECT_DIR'" >&2; exit 2; }

# ── Preconditions ───────────────────────────────────────────────────────────
# A missing prerequisite is exit 2. If we cannot tell what to run, we must not
# report a pass.
[ -f package.json ] || { echo "ERROR: no package.json in $(pwd) — cannot determine checks." >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not on PATH." >&2; exit 2; }

# has_script <name> — true if package.json defines that npm script.
has_script() {
  node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)" 2>/dev/null
}

# Order: cheap checks first for fast feedback, EXCEPT that the secret scan runs
# last, after the build.
#
# Why: secret scanners commonly scan BUILD OUTPUT (e.g. .next/static) to catch
# secrets that leaked into the client bundle. Run before the build, they find an
# empty or absent directory and — in every implementation seen so far — report
# clean and exit 0. That is a false PASS on a clean checkout, and it is the same
# "did not run reads as found nothing" failure this whole gate exists to prevent
# (gates/GATES.md). Correctness beats fast feedback here.
#
# Format: "label|npm-script".
CANDIDATES=(
  "TypeScript|typecheck"
  "Lint|lint"
  "Tests|test"
  "Build|build"
  "Secret scan|check:secrets"
)

SELECTED=()
SKIPPED=()
for entry in "${CANDIDATES[@]}"; do
  label="${entry%%|*}"; script="${entry##*|}"
  if has_script "$script"; then SELECTED+=("$entry"); else SKIPPED+=("$label ($script)"); fi
done

if [ "${#SELECTED[@]}" -eq 0 ]; then
  echo "ERROR: package.json defines none of: typecheck, lint, check:secrets, test, build." >&2
  echo "       Nothing to gate on. Refusing to report a pass." >&2
  exit 2
fi

if [ "$LIST_ONLY" -eq 1 ]; then
  echo "Would run in $(pwd):"
  for entry in "${SELECTED[@]}"; do echo "  ✓ ${entry%%|*}  (npm run ${entry##*|})"; done
  for s in ${SKIPPED[@]+"${SKIPPED[@]}"}; do echo "  – $s — not defined"; done
  exit 0
fi

# ── Run ─────────────────────────────────────────────────────────────────────
FAILED=0
BROKEN=0
RESULTS=()
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

echo "Gate: $(pwd)"
echo

for entry in "${SELECTED[@]}"; do
  label="${entry%%|*}"; script="${entry##*|}"
  printf '  %-14s ... ' "$label"
  log="$LOG_DIR/$script.log"

  npm run "$script" >"$log" 2>&1
  status=$?

  # Distinguish "the tool ran and reported problems" from "the tool did not run".
  # npm exits 127 when the underlying binary is missing; that is BROKEN, not FAIL.
  if [ "$status" -eq 0 ]; then
    echo "PASS"
    RESULTS+=("| $label | **PASS** |")
  elif grep -qiE 'command not found|not recognized as|ENOENT.*spawn' "$log"; then
    echo "BROKEN (tool missing)"
    RESULTS+=("| $label | **BROKEN — tool missing** |")
    BROKEN=1
  else
    echo "FAIL (exit $status)"
    RESULTS+=("| $label | **FAIL** (exit $status) |")
    FAILED=1
  fi

  if [ "$status" -ne 0 ]; then
    sed 's/^/      /' "$log" | tail -15
    echo
  fi
done

for s in ${SKIPPED[@]+"${SKIPPED[@]}"}; do
  printf '  %-14s ... N/A — script not defined\n' "${s%% (*}"
  RESULTS+=("| ${s%% (*} | N/A — not defined |")
done

# ── Report ──────────────────────────────────────────────────────────────────
echo
echo "Paste into the phase document:"
echo
echo "| Check | Result |"
echo "|---|---|"
printf '%s\n' "${RESULTS[@]}"
echo

if [ "$BROKEN" -eq 1 ]; then
  echo "GATE BROKEN — a check could not run. This is not a pass." >&2
  exit 2
fi
if [ "$FAILED" -eq 1 ]; then
  echo "GATE FAILED — fix CRITICAL/HIGH findings and re-run."
  exit 1
fi

echo "GATE PASSED — all applicable mechanical checks green."
echo
echo "Reminder: this covers MECHANICAL checks only. The judgment gate for this"
echo "phase (the audit findings) is separate — see gates/GATES.md."
exit 0
