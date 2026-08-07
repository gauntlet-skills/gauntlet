#!/usr/bin/env node
/**
 * lint-buildplan — structural gate for a BUILD.md.
 *
 * Checks the properties a build document must have for an agent to execute it
 * reliably. Structure only: it cannot tell you the prompts are *good*, only that
 * they are shaped correctly and that nothing was silently dropped.
 *
 * Exit codes (never collapse these into two):
 *   0  structure valid
 *   1  problems found
 *   2  could not run — broken, NOT clean
 *
 * Usage: lint-buildplan.mjs BUILD.md [--json]
 */
import { readFileSync, existsSync, statSync } from 'node:fs';

const WORD_MIN = 250;
const WORD_MAX = 600;
const CHECK_MIN = 5;
const CHECK_MAX = 10;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('ERROR: no file given.\nUsage: lint-buildplan.mjs BUILD.md [--json]');
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`ERROR: ${file} does not exist. Refusing to report a pass.`);
  process.exit(2);
}
if (!statSync(file).isFile()) {
  console.error(`ERROR: ${file} is not a file.`);
  process.exit(2);
}

const src = readFileSync(file, 'utf8');
if (src.trim() === '') {
  console.error(`ERROR: ${file} is empty. Refusing to report a pass on an empty document.`);
  process.exit(2);
}

// ── Parse ───────────────────────────────────────────────────────────────────
// A prompt is "## Prompt <id> — title"; its body runs to the next "## Prompt"
// or EOF. Checkpoints are "### Checkpoint <id>" inside that span.
// Accept ##/###/#### — real plans vary in heading depth (Waypoint uses ###),
// and rejecting on depth alone would flag a valid document as unparseable.
// Separator class includes ':' — the Gauntlet generator emits
// "## PROMPT 1: Spec validation", and requiring a dash made this exit 2 on the
// very documents the product produces. Exiting 2 on valid input is the fastest
// route to a gate being switched off.
const promptRe = /^#{2,4}\s+Prompt\s+([0-9]+[a-z]?)\s*[—–:-]\s*(.+)$/gim;
const marks = [...src.matchAll(promptRe)].map((m) => ({
  id: m[1],
  title: m[2].trim(),
  start: m.index,
}));

if (marks.length === 0) {
  console.error('ERROR: no "## Prompt N — title" headings found.');
  console.error('       Either this is not a build plan or the heading format differs.');
  console.error('       Refusing to report a pass on a document it cannot parse.');
  process.exit(2);
}

const prompts = marks.map((m, i) => ({
  ...m,
  body: src.slice(m.start, i + 1 < marks.length ? marks[i + 1].start : src.length),
}));

// ── Checks ──────────────────────────────────────────────────────────────────
const problems = [];
const add = (id, msg) => problems.push({ id, msg });

for (const p of prompts) {
  const label = `Prompt ${p.id}`;

  const fences = [...p.body.matchAll(/^```/gm)];
  if (fences.length < 2) {
    add(label, 'no fenced prompt block');
    continue;
  }

  const fenceStart = p.body.indexOf('\n', fences[0].index) + 1;
  const fenceEnd = fences[1].index;
  const inner = p.body.slice(fenceStart, fenceEnd);

  const words = inner.split(/\s+/).filter(Boolean).length;
  if (words < WORD_MIN) add(label, `prompt body is ${words} words (min ${WORD_MIN}) — under-specified`);
  if (words > WORD_MAX) add(label, `prompt body is ${words} words (max ${WORD_MAX}) — agents drop middle requirements`);

  // Pasted implementation. A build prompt briefs; it does not dictate.
  const codey = inner.match(/^\s*(import |export (const|function|default)|const \w+ = (async )?\(|function \w+\()/gm);
  if (codey && codey.length >= 3) {
    add(label, `looks like pasted code (${codey.length} code lines) — prompts are instructions, not implementations`);
  }

  // Checkpoint present, after the fence, correctly sized.
  const cp = p.body.match(new RegExp(`^###\\s+Checkpoint\\s+${p.id}\\b`, 'im'));
  if (!cp) {
    add(label, `missing "### Checkpoint ${p.id}"`);
    continue;
  }
  if (cp.index < fenceEnd) {
    add(label, 'checkpoint is inside the fenced block — must come after the closing fence');
  }

  const cpBody = p.body.slice(cp.index);
  const items = [...cpBody.matchAll(/^\s*-\s*\[ \]\s+(.+)$/gm)].map((m) => m[1].trim());
  if (items.length < CHECK_MIN) add(label, `checkpoint has ${items.length} items (min ${CHECK_MIN})`);
  if (items.length > CHECK_MAX) add(label, `checkpoint has ${items.length} items (max ${CHECK_MAX})`);

  // At least one item must assert behaviour rather than existence. A checkpoint
  // that only confirms files exist verifies nothing the agent could have failed.
  const behavioural = items.filter((i) =>
    // `match(es)?` not `matches?` — the latter requires the "e" and so misses
    // the bare "match", which is how most people write the assertion.
    /\b(returns?|responds?|rejects?|blocks?|redirects?|exits?|throws?|fails?|shows?|renders?|equals?|match(es)?|contains?|removes?|creates?|\b[45]\d\d\b|\b2\d\d\b)\b/i.test(i)
  );
  if (items.length > 0 && behavioural.length === 0) {
    add(label, 'no checkpoint item asserts behaviour — all are existence checks');
  }
}

// Numbering continuity: a gap usually means a prompt was dropped in generation.
const nums = prompts.map((p) => parseInt(p.id, 10));
for (let i = 1; i < nums.length; i++) {
  const gap = nums[i] - nums[i - 1];
  if (gap > 1) add('sequence', `numbering jumps ${nums[i - 1]} → ${nums[i]} — a prompt may have been dropped`);
}

// ── Report ──────────────────────────────────────────────────────────────────
if (asJson) {
  console.log(JSON.stringify({ file, prompts: prompts.length, problems }, null, 2));
} else {
  console.log(`lint-buildplan: ${file}`);
  console.log(`  ${prompts.length} prompt(s) parsed\n`);
  if (problems.length === 0) {
    console.log('  no structural problems found');
  } else {
    for (const p of problems) console.log(`  ${p.id.padEnd(12)} ${p.msg}`);
  }
  console.log('');
}

if (problems.length > 0) {
  console.log(`FAILED — ${problems.length} structural problem(s).`);
  console.log('Structure only; a clean result does not mean the prompts are good.');
  process.exit(1);
}
console.log('PASSED — structure valid.');
console.log('Structure only; a clean result does not mean the prompts are good.');
process.exit(0);
