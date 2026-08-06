#!/usr/bin/env node
/**
 * Canary for lint-buildplan.mjs.
 *
 * A structural linter that never fires reports every document valid. This proves
 * each check fires on a planted defect, that a good document still passes, and
 * that "could not run" never masquerades as "clean".
 *
 * Run:  node gates/canary-test.mjs
 * Exit: 0 all assertions held · 1 an assertion failed
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINT = join(dirname(fileURLToPath(import.meta.url)), 'lint-buildplan.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'buildplan-canary-'));

let passed = 0;
let failed = 0;

function run(path) {
  const r = spawnSync(process.execPath, [LINT, path], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function assert(name, wantCode, path, wantText) {
  const { code, out } = run(path);
  const codeOk = code === wantCode;
  const textOk = !wantText || wantText.test(out);
  if (codeOk && textOk) {
    console.log(`  ok    ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${name}`);
    if (!codeOk) console.log(`          expected exit ${wantCode}, got ${code}`);
    if (!textOk) console.log(`          expected output matching ${wantText}`);
    failed++;
  }
}

/** Build a syntactically valid prompt with `words` words and `checks` items. */
function prompt(id, { words = 300, checks = 6, behavioural = true, code = false, cpInside = false } = {}) {
  const body = code
    ? Array.from({ length: 5 }, (_, i) => `import { thing${i} } from './mod${i}';`).join('\n') +
      '\n' + 'filler '.repeat(Math.max(0, words - 30))
    : 'Create the files below with the exact values given. ' + 'requirement '.repeat(Math.max(0, words - 9));
  const items = Array.from({ length: checks }, (_, i) =>
    behavioural && i === 0
      ? '- [ ] `GET /api/health` returns 200'
      : `- [ ] file number ${i} is present in the tree`
  ).join('\n');
  const cp = `### Checkpoint ${id}\n\n${items}\n`;
  return cpInside
    ? `## Prompt ${id} — Title\n\n\`\`\`\n${body}\n\n${cp}\`\`\`\n`
    : `## Prompt ${id} — Title\n\n\`\`\`\n${body}\n\`\`\`\n\n${cp}`;
}

function write(name, content) {
  const p = join(tmp, name);
  writeFileSync(p, content);
  return p;
}

console.log('Canary: lint-buildplan.mjs\n');

// ── could-not-run paths must be exit 2, never 0 ─────────────────────────────
assert('missing file is BROKEN', 2, join(tmp, 'nope.md'), /does not exist/);
assert('empty file is BROKEN', 2, write('empty.md', '   \n'), /empty/);
assert('unparseable file is BROKEN', 2, write('prose.md', '# Notes\n\nJust prose.\n'), /no "## Prompt/);
const dir = join(tmp, 'adir.md');
mkdirSync(dir, { recursive: true });
assert('directory is BROKEN', 2, dir, /not a file/);

// ── a good document must pass ───────────────────────────────────────────────
assert(
  'well-formed plan passes',
  0,
  write('good.md', [prompt(1), prompt(2), prompt(3)].join('\n')),
  /PASSED/
);

// ── each check must fire ────────────────────────────────────────────────────
assert(
  'missing checkpoint fires',
  1,
  write('no-cp.md', '## Prompt 1 — Title\n\n```\n' + 'word '.repeat(300) + '\n```\n'),
  /missing "### Checkpoint 1"/
);
assert('too-short prompt fires', 1, write('short.md', prompt(1, { words: 40 })), /under-specified/);
assert('too-long prompt fires', 1, write('long.md', prompt(1, { words: 900 })), /max 600/);
assert('too-few checkpoint items fires', 1, write('few.md', prompt(1, { checks: 2 })), /min 5/);
assert('too-many checkpoint items fires', 1, write('many.md', prompt(1, { checks: 14 })), /max 10/);
assert(
  'existence-only checkpoint fires',
  1,
  write('exist.md', prompt(1, { behavioural: false })),
  /no checkpoint item asserts behaviour/
);
assert('pasted code fires', 1, write('code.md', prompt(1, { code: true })), /pasted code/);
assert(
  'checkpoint inside the fence fires',
  1,
  write('inside.md', prompt(1, { cpInside: true })),
  /inside the fenced block|missing "### Checkpoint/
);
assert(
  'numbering gap fires',
  1,
  write('gap.md', [prompt(1), prompt(5)].join('\n')),
  /numbering jumps 1 → 5/
);

rmSync(tmp, { recursive: true, force: true });

console.log('');
if (failed > 0) {
  console.log(`CANARY FAILED: ${failed} of ${passed + failed} assertions did not hold.`);
  console.log('Do not trust lint-buildplan.mjs until this is green.');
  process.exit(1);
}
console.log(`CANARY PASSED: ${passed}/${passed}. Every check fires, and a good plan still passes.`);
process.exit(0);
