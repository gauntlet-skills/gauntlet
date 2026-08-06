#!/usr/bin/env node
/**
 * check-extracted — verify the generated reference files have not been edited.
 *
 * Parts of this skill are generated from source that does not ship with it (the
 * analyzer rubric, the build specs). Once published, nothing here can regenerate
 * them to prove they are current — so instead each generated file is hashed at
 * generation time into MANIFEST.json, and this checks the shipped bytes against
 * those hashes.
 *
 * What it catches: a hand-edit to a generated file, a partial copy, a corrupted
 * download. What it does NOT catch: someone who edits a file AND updates the
 * manifest. This is tamper-EVIDENCE, not tamper-proofing, and the distinction
 * matters — do not read a pass here as a guarantee of provenance.
 *
 * Each generated file also carries a `<!-- source-sha256: ... -->` comment
 * naming the source revision it came from. Two copies with the same value came
 * from the same source; a different value means the upstream changed.
 *
 * Exit codes:
 *   0  every listed file matches its hash
 *   1  a file is missing or modified
 *   2  could not run — broken, NOT clean
 *
 * Usage:  node gates/check-extracted.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The generated files live in references/ or reference/ depending on the skill.
const candidates = ['references', 'reference']
  .map((d) => join(SKILL_ROOT, d))
  .filter((d) => existsSync(join(d, 'MANIFEST.json')));

if (candidates.length === 0) {
  console.error('ERROR: no MANIFEST.json found under references/ or reference/.');
  console.error('       Nothing to verify against. Refusing to report a pass.');
  process.exit(2);
}

const sha256 = (t) => createHash('sha256').update(t.replace(/\r\n/g, '\n')).digest('hex');

let checked = 0;
const problems = [];

for (const dir of candidates) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'MANIFEST.json'), 'utf8'));
  } catch (err) {
    console.error(`ERROR: MANIFEST.json in ${dir} is not valid JSON: ${err.message}`);
    process.exit(2);
  }
  const files = manifest?.files;
  if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
    console.error(`ERROR: MANIFEST.json in ${dir} lists no files. Refusing to report a pass.`);
    process.exit(2);
  }

  for (const [name, want] of Object.entries(files)) {
    const p = join(dir, name);
    if (!existsSync(p)) { problems.push(`MISSING   ${name}`); continue; }
    const got = sha256(readFileSync(p, 'utf8'));
    if (got !== want) {
      problems.push(`MODIFIED  ${name}\n            expected ${want.slice(0, 16)}…\n            found    ${got.slice(0, 16)}…`);
    } else {
      checked++;
    }
  }

  // A generated file present in the directory but absent from the manifest is
  // itself a signal — either the manifest is stale or something was added by hand.
  const listed = new Set([...Object.keys(files), 'MANIFEST.json']);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    if (listed.has(f)) continue;
    // Hand-written references are expected; only flag ones claiming to be generated.
    const head = readFileSync(join(dir, f), 'utf8').slice(0, 600);
    if (/source-sha256|Generated from/i.test(head)) {
      problems.push(`UNLISTED  ${f} claims to be generated but is not in MANIFEST.json`);
    }
  }
}

console.log(`check-extracted: ${SKILL_ROOT}\n`);
if (problems.length === 0) {
  console.log(`  ${checked} generated file(s) match their recorded hash`);
  console.log('\nPASSED — generated files are intact.');
  console.log('Tamper-evidence only: a matching hash does not prove upstream provenance.');
  process.exit(0);
}
for (const p of problems) console.log(`  ✗ ${p}`);
console.log(`\nFAILED — ${problems.length} problem(s).`);
console.log('Regenerate from the source repo, or re-download this skill.');
process.exit(1);
