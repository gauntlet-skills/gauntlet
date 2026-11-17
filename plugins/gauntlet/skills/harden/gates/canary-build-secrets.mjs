#!/usr/bin/env node
/**
 * Canary for check-build-secrets.mjs.
 *
 * Builds throwaway "build output" trees in a temp dir and proves the scan
 * passes a clean build, fires on a secret marker planted in a middleware
 * bundle and in a source map, and reports every could-not-run case (no
 * positive control, missing or empty dir, bad flags) as exit 2, never as a
 * pass. Each planted file is read back before the gate runs, so a plant that
 * silently did not land cannot turn a "bad" run into a clean one.
 *
 * Run:  node gates/canary-build-secrets.mjs
 * Exit: 0 all assertions held · 1 an assertion failed
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), 'check-build-secrets.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'build-secrets-canary-'));

const PUB = 'gxpub_canary_4f2e91';
const SEC_A = 'gxsec_canary_svc_8a01';
const SEC_B = 'gxsec_canary_pay_37cd';

/** Write a fake build tree. `files` maps relative path to content. */
function tree(name, files) {
  const root = join(tmp, name);
  for (const [rel, content] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
    // Prove the plant landed before trusting any result built on it.
    if (!readFileSync(p).equals(Buffer.from(content))) throw new Error(`plant did not land: ${p}`);
  }
  return root;
}

const clean = {
  'static/chunks/app.js': `const url="${PUB}";console.log(url);`,
  'server/middleware.js': 'export default function m(){return null}',
  'server/app/page.js': 'module.exports={}',
};
const ROOTS = {
  clean: tree('clean', clean),
  edgeLeak: tree('edge-leak', {
    ...clean,
    'server/middleware.js': `var e={"SVC":"${SEC_A}"};export default function m(){return e}`,
  }),
  mapLeak: tree('map-leak', {
    ...clean,
    'static/chunks/app.js.map': `{"sourcesContent":["const k='${SEC_B}'"]}`,
  }),
  noPublic: tree('no-public', { 'static/chunks/app.js': 'console.log(1)' }),
  empty: (() => { const p = join(tmp, 'empty'); mkdirSync(p); return p; })(),
};

const run = (args) => spawnSync(process.execPath, [GATE, ...args], { encoding: 'utf8' });
const std = (root) => [root, '--public', PUB, '--secret', SEC_A, '--secret', SEC_B];

let failed = 0;
let total = 0;
function expect(label, args, code, mustSay) {
  total++;
  const r = run(args);
  const out = `${r.stdout}${r.stderr}`;
  const okCode = r.status === code;
  const okSay = !mustSay || out.includes(mustSay);
  if (okCode && okSay) {
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}: exit ${r.status} (wanted ${code})${okSay ? '' : `, output lacks "${mustSay}"`}`);
    console.log(out.split('\n').map((l) => `        ${l}`).join('\n'));
  }
}

console.log('Canary: check-build-secrets.mjs');
try {
  expect('clean build passes (exit 0)', std(ROOTS.clean), 0, 'PASSED');
  expect('secret in middleware bundle fires (exit 1)', std(ROOTS.edgeLeak), 1, 'edge/middleware bundle');
  expect('secret in a source map fires (exit 1)', std(ROOTS.mapLeak), 1, SEC_B);
  expect('public marker absent is BROKEN (exit 2)', std(ROOTS.noPublic), 2, 'public marker');
  expect('empty build dir is BROKEN (exit 2)', std(ROOTS.empty), 2, 'no files');
  expect('missing build dir is BROKEN (exit 2)', std(join(tmp, 'nope')), 2, 'not found');
  expect('no --secret is BROKEN (exit 2)', [ROOTS.clean, '--public', PUB], 2, 'no --secret');
  expect('no --public is BROKEN (exit 2)', [ROOTS.clean, '--secret', SEC_A], 2, 'no --public');
  expect('repeated --public is BROKEN (exit 2)', [...std(ROOTS.clean), '--public', 'gxpub_other_000000'], 2, 'more than once');
  expect('short marker is BROKEN (exit 2)', [ROOTS.clean, '--public', PUB, '--secret', 'abc'], 2, 'shorter');
  expect('secret equal to public is BROKEN (exit 2)', [ROOTS.clean, '--public', PUB, '--secret', PUB], 2, 'also listed');
  expect('unknown flag is BROKEN (exit 2)', [...std(ROOTS.clean), '--quiet'], 2, 'unknown flag');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
if (failed) {
  console.log(`CANARY FAILED: ${failed}/${total}. check-build-secrets.mjs cannot be trusted.`);
  process.exit(1);
}
console.log(`CANARY PASSED: ${total}/${total}. check-build-secrets.mjs can pass, can fail, and knows the difference.`);
process.exit(0);
