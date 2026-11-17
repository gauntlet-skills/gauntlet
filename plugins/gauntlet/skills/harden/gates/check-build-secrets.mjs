#!/usr/bin/env node
/**
 * check-build-secrets — build-and-grep secret canary for Phase P (pentest).
 *
 * Grepping SOURCE for a secret cannot prove it is absent from what ships.
 * Bundlers inline environment variables at build time, and an Edge middleware
 * that imports a module touching `process.env` as a whole can bake every
 * server secret into the compiled middleware bundle. A code review sees one
 * innocent import. Only the build output shows the leak.
 *
 * So: build the app with a unique MARKER value in every secret variable, plus
 * one marker in a public variable the client actually uses, then point this at
 * the build output. It searches every file, bytes not text, so source maps and
 * minified chunks count.
 *
 *   - The public marker MUST appear. That is the positive control: it proves the
 *     build used your marker values and the scan read real output. If it is
 *     missing, the run proves nothing and exits 2.
 *   - No secret marker may appear anywhere.
 *
 * Exit codes:
 *   0  public marker found, no secret marker found
 *   1  a secret marker is in the build output
 *   2  could not run, broken, NOT clean (missing dir, empty dir, no markers,
 *      public marker absent, bad flags)
 *
 * Usage:
 *   check-build-secrets.mjs <build-dir> --public <marker> --secret <marker> [--secret <marker> ...]
 *   check-build-secrets.mjs .next --public gxpub_7d1c0a9e44 --secret gxsec_svc_51ab90 --secret gxsec_stripe_e02c77
 *
 * Markers must be at least 10 characters and distinct, so a hit cannot be a
 * coincidence. `--public` may be given once; a repeated flag is refused rather
 * than letting the first or last silently win.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MIN_MARKER = 10;
const argv = process.argv.slice(2);

function broken(msg) {
  console.error(`ERROR: ${msg}`);
  console.error('       Could not run. Refusing to report a pass.');
  process.exit(2);
}

// ── parse flags ─────────────────────────────────────────────────────────────
let dir = null;
const publics = [];
const secrets = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--public' || a === '--secret') {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) broken(`${a} needs a value`);
    (a === '--public' ? publics : secrets).push(v);
    i++;
  } else if (a.startsWith('--')) {
    broken(`unknown flag ${a}`);
  } else if (dir === null) {
    dir = a;
  } else {
    broken(`unexpected argument ${a} (one build directory only)`);
  }
}

if (!dir) broken('no build directory given');
if (!existsSync(dir) || !statSync(dir).isDirectory()) broken(`build directory not found: ${dir}`);
if (publics.length === 0) broken('no --public marker. Without the positive control a clean result means nothing');
if (publics.length > 1) broken('--public given more than once');
if (secrets.length === 0) broken('no --secret markers given');
const pub = publics[0];
for (const m of [pub, ...secrets]) {
  if (m.length < MIN_MARKER) broken(`marker "${m}" is shorter than ${MIN_MARKER} characters`);
}
if (new Set(secrets).size !== secrets.length) broken('a --secret marker is repeated');
if (secrets.includes(pub)) broken('the public marker is also listed as a secret');
for (const s of secrets) {
  if (s.includes(pub) || pub.includes(s)) broken(`markers "${s}" and "${pub}" overlap; make them distinct`);
}

// ── walk ────────────────────────────────────────────────────────────────────
// Symlinks are not followed: a link loop would hang, and a link out of the
// build dir would scan something that does not ship.
const files = [];
const walk = (d) => {
  let entries;
  try {
    entries = readdirSync(d, { withFileTypes: true });
  } catch (err) {
    broken(`cannot read ${d}: ${err.message}`);
  }
  for (const e of entries) {
    const p = join(d, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(p);
    else if (e.isFile()) files.push(p);
  }
};
walk(dir);
if (files.length === 0) broken(`no files under ${dir}. Did the build run?`);

// Edge and middleware bundles are where whole-env inlining lands. Report them
// first so the most likely leak is the first line read.
const isEdge = (p) => /middleware|edge/i.test(relative(dir, p).split(sep).join('/'));
files.sort((a, b) => Number(isEdge(b)) - Number(isEdge(a)) || a.localeCompare(b));

const pubBuf = Buffer.from(pub);
const secBufs = secrets.map((s) => ({ s, b: Buffer.from(s) }));
let pubHits = 0;
const leaks = [];
for (const f of files) {
  let buf;
  try {
    buf = readFileSync(f);
  } catch (err) {
    broken(`cannot read ${f}: ${err.message}`);
  }
  if (buf.includes(pubBuf)) pubHits++;
  for (const { s, b } of secBufs) {
    if (buf.includes(b)) leaks.push({ file: relative(dir, f), marker: s, edge: isEdge(f) });
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(`check-build-secrets: ${files.length} file(s) scanned under ${dir}`);
if (pubHits === 0) {
  broken(
    `public marker "${pub}" not found in any file. The build did not use your marker ` +
      'values, the wrong directory was scanned, or the public variable is never read by client code. ' +
      'A clean secret result from this run would prove nothing',
  );
}
console.log(`  ok    public marker present in ${pubHits} file(s) (positive control)`);
if (leaks.length === 0) {
  console.log(`  ok    none of ${secrets.length} secret marker(s) found`);
  console.log('\nPASSED: no secret marker in the build output.');
  process.exit(0);
}
for (const l of leaks) {
  console.log(`  LEAK  ${l.marker}  in  ${l.file}${l.edge ? '  (edge/middleware bundle)' : ''}`);
}
console.log(`\nFAILED: ${leaks.length} secret marker hit(s). Treat every hit as a real secret shipped to that bundle.`);
process.exit(1);
