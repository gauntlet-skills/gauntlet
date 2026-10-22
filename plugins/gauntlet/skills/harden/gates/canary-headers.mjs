#!/usr/bin/env node
/**
 * Canary for check-headers.mjs.
 *
 * Serves planted headers from a local server and proves the audit fires on each
 * defect, passes a clean route, and reports "could not run" as exit 2 rather
 * than as a pass. Covers --expect drift (including the "must be absent" form),
 * and pins --preview exactly: the same unframed response fails a production
 * audit and passes a preview audit, a preview that blocks framing fails, and
 * preview mode relaxes nothing else.
 *
 * Run:  node gates/canary-headers.mjs
 * Exit: 0 all assertions held · 1 an assertion failed
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), 'check-headers.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'headers-canary-'));

const CSP = "default-src 'self'; frame-ancestors 'none'";
const CLEAN = {
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
};
const without = (k) => Object.fromEntries(Object.entries(CLEAN).filter(([n]) => n !== k));

const ROUTES = {
  '/clean': CLEAN,
  '/no-frame': { ...without('x-frame-options'), 'content-security-policy': "default-src 'self'" },
  '/report-only': { ...without('content-security-policy'), 'content-security-policy-report-only': CSP },
  '/unsafe-eval': { ...CLEAN, 'content-security-policy': `${CSP}; script-src 'self' 'unsafe-eval'` },
  '/reordered': { ...CLEAN, 'content-security-policy': "frame-ancestors 'none';  default-src 'self'" },
  '/vercel': { ...CLEAN, 'x-vercel-cache': 'PRERENDER' },
  // Builder preview hosts: no framing header, or framing allowed for the builder.
  '/preview-open': { ...without('x-frame-options'), 'content-security-policy': "default-src 'self'" },
  '/preview-builder': { ...without('x-frame-options'), 'content-security-policy': "default-src 'self'; frame-ancestors https://builder.example" },
  '/preview-self': { ...without('x-frame-options'), 'content-security-policy': "default-src 'self'; frame-ancestors 'self'" },
  '/preview-eval': { ...without('x-frame-options'), 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-eval'" },
  '/preview-nohsts': {
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
};

const server = createServer((req, res) => {
  const h = ROUTES[req.url];
  res.writeHead(h ? 200 : 404, h ?? {});
  res.end('ok');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const policy = (name, obj) => {
  const p = join(tmp, name);
  writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return p;
};
const matching = policy('match.json', { 'content-security-policy': CSP, 'X-Frame-Options': 'DENY' });
const drifted = policy('drift.json', { 'content-security-policy': "default-src 'none'" });
const mustBeAbsent = policy('absent.json', { 'x-frame-options': null });
const notJson = policy('bad.json', '{ not json');
const empty = policy('empty.json', {});
const wrongType = policy('wrong-type.json', { 'x-frame-options': 5 });
const isArray = policy('array.json', ['x-frame-options']);

// spawn, not spawnSync: the server shares this event loop and must keep answering.
function run(args) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [GATE, ...args], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    let out = '';
    c.stdout.on('data', (d) => (out += d));
    c.stderr.on('data', (d) => (out += d));
    c.on('close', (code) => resolve({ code, out }));
  });
}

let passed = 0;
let failed = 0;
async function assert(name, wantCode, args, wantText, notText) {
  const { code, out } = await run(args);
  const codeOk = code === wantCode;
  const textOk = !wantText || wantText.test(out);
  const notOk = !notText || !notText.test(out);
  if (codeOk && textOk && notOk) {
    console.log(`  ok    ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${name}`);
    if (!codeOk) console.log(`          expected exit ${wantCode}, got ${code}`);
    if (!textOk) console.log(`          expected output matching ${wantText}`);
    if (!notOk) console.log(`          expected output NOT matching ${notText}`);
    failed++;
  }
}

console.log('Canary: check-headers.mjs');
await assert('clean route passes', 0, [ORIGIN, '/clean'], /no findings/);
await assert('missing frame protection fires', 1, [ORIGIN, '/no-frame'], /FRAME/);
await assert("'unsafe-eval' fires", 1, [ORIGIN, '/unsafe-eval'], /unsafe-eval/);
await assert('report-only CSP is named, not "missing"', 1, [ORIGIN, '/report-only'], /report-only/, /Content-Security-Policy missing/);
await assert('non-Vercel host gets the classifier note', 0, [ORIGIN, '/clean'], /No Next\.js\/Vercel markers/);
await assert('Vercel marker suppresses the note', 0, [ORIGIN, '/vercel'], /static/, /No Next\.js\/Vercel markers/);
await assert('--expect matching policy passes', 0, [ORIGIN, '/clean', '--expect', matching], /no findings/);
await assert('--expect ignores CSP directive order', 0, [ORIGIN, '/reordered', '--expect', matching], /no findings/);
await assert('--expect drift fires', 1, [ORIGIN, '/clean', '--expect', drifted], /EXPECT-DRIFT/);
await assert('--expect null pins a header absent', 1, [ORIGIN, '/clean', '--expect', mustBeAbsent], /must be absent/);
await assert('--expect null raises no drift when absent', 1, [ORIGIN, '/no-frame', '--expect', mustBeAbsent], /FRAME/, /EXPECT-DRIFT/);

// Production vs builder preview. The same unframed response must FAIL on a
// production audit and PASS on a preview audit; a preview that blocks framing
// must FAIL; and preview mode must not relax any other check.
await assert('production: unframed route fires FRAME', 1, [ORIGIN, '/preview-open'], /No clickjacking protection/);
await assert('preview: unframed route is clean', 0, [ORIGIN, '/preview-open', '--preview'], /no findings/, /FRAME/);
await assert('preview: says it is in preview mode', 0, [ORIGIN, '/preview-open', '--preview'], /PREVIEW MODE/);
await assert('preview: framing allowed for the builder is clean', 0, [ORIGIN, '/preview-builder', '--preview'], /no findings/);
await assert('preview: X-Frame-Options fires', 1, [ORIGIN, '/clean', '--preview'], /PREVIEW-FRAMED[\s\S]*X-Frame-Options: DENY/);
await assert("preview: frame-ancestors 'none' fires", 1, [ORIGIN, '/clean', '--preview'], /restricts framing to 'none'/);
await assert("preview: frame-ancestors 'self' fires", 1, [ORIGIN, '/preview-self', '--preview'], /restricts framing to 'self'/);
await assert("preview: 'unsafe-eval' still fires", 1, [ORIGIN, '/preview-eval', '--preview'], /unsafe-eval/, /PREVIEW-FRAMED/);
await assert('preview: missing HSTS still fires', 1, [ORIGIN, '/preview-nohsts', '--preview'], /HSTS/, /PREVIEW-FRAMED/);
await assert('preview + --expect null: clean when absent', 0, [ORIGIN, '/preview-open', '--preview', '--expect', mustBeAbsent], /no findings/);
await assert('misspelt flag is BROKEN, not a production run', 2, [ORIGIN, '/preview-open', '--preveiw'], /unknown flag/);
await assert('--expect twice is BROKEN', 2, [ORIGIN, '/clean', '--expect', matching, '--expect', drifted], /more than once/);
await assert('--expect unreadable file is BROKEN', 2, [ORIGIN, '/clean', '--expect', join(tmp, 'nope.json')], /could not read/);
await assert('--expect invalid JSON is BROKEN', 2, [ORIGIN, '/clean', '--expect', notJson], /could not read/);
await assert('--expect empty policy is BROKEN', 2, [ORIGIN, '/clean', '--expect', empty], /non-empty/);
await assert('--expect with no file is BROKEN', 2, [ORIGIN, '/clean', '--expect'], /needs a file/);
await assert('--expect non-string value is BROKEN', 2, [ORIGIN, '/clean', '--expect', wrongType], /string or null/);
await assert('--expect array policy is BROKEN', 2, [ORIGIN, '/clean', '--expect', isArray], /string or null/);
await assert('mangled MSYS path is BROKEN', 2, [ORIGIN, 'C:/Program Files/Git/'], /not a URL path/);

server.close();
await assert('unreachable origin is BROKEN', 2, [ORIGIN, '/clean'], /could not be reached/);

rmSync(tmp, { recursive: true, force: true });
console.log('');
if (failed > 0) {
  console.log(`CANARY FAILED: ${failed} of ${passed + failed} assertions did not hold.`);
  console.log('Do not trust check-headers.mjs until this is green.');
  process.exitCode = 1;
} else {
  console.log(`CANARY PASSED: ${passed}/${passed}. check-headers.mjs can pass, can fail, and knows the difference.`);
}
