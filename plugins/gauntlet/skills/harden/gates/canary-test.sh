#!/usr/bin/env bash
# Canary test for run-gate.sh.
#
# Per gates/GATES.md: a gate you have not seen fail is not a gate, and the proof
# has to be permanent or the gate rots the next time someone edits it.
#
# This asserts all three exit states, in both directions:
#   - a clean project passes   (a gate that fails on everything gets disabled)
#   - a real failure fires     (the property that matters)
#   - a missing tool is BROKEN, not a pass and not a plain failure
#
# Run:  gates/canary-test.sh
# Exit: 0 all assertions held · 1 an assertion failed
#
set -uo pipefail

GATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-gate.sh"
[ -x "$GATE" ] || { echo "FAIL: run-gate.sh missing or not executable at $GATE"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASSED=0
FAILED=0

# assert <name> <expected-exit> <dir-or-flag>
assert() {
  local name="$1" want="$2" target="$3" got
  "$GATE" "$target" >/dev/null 2>&1
  got=$?
  if [ "$got" -eq "$want" ]; then
    echo "  ok    $name (exit $got)"
    PASSED=$((PASSED + 1))
  else
    echo "  FAIL  $name — expected exit $want, got $got"
    FAILED=$((FAILED + 1))
  fi
}

mk() { mkdir -p "$TMP/$1"; printf '%s' "$2" > "$TMP/$1/package.json"; }

mk pass   '{"name":"c","scripts":{"typecheck":"node -e \"0\"","test":"node -e \"0\""}}'
mk fail   '{"name":"c","scripts":{"typecheck":"node -e \"process.exit(1)\""}}'
mk broken '{"name":"c","scripts":{"typecheck":"totally-not-a-real-binary-xyz"}}'
mkdir -p "$TMP/nopkg"
mk empty  '{"name":"c","scripts":{"start":"node -e \"0\""}}'

echo "Canary: run-gate.sh"
assert "clean project passes"           0 "$TMP/pass"
assert "real failure fires the gate"    1 "$TMP/fail"
assert "missing tool reports BROKEN"    2 "$TMP/broken"
assert "no package.json is BROKEN"      2 "$TMP/nopkg"
assert "no known scripts is BROKEN"     2 "$TMP/empty"
assert "nonexistent dir is BROKEN"      2 "$TMP/does-not-exist"

echo
if [ "$FAILED" -gt 0 ]; then
  echo "CANARY FAILED: $FAILED of $((PASSED + FAILED)) assertions did not hold."
  echo "Do not trust run-gate.sh until this is green."
  exit 1
fi
echo "CANARY PASSED: $PASSED/$PASSED. run-gate.sh can pass, can fail, and knows the difference."
exit 0
