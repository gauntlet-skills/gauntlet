#!/usr/bin/env node
/**
 * check-headers — HTTP surface audit for Phase B6 (domain audit).
 *
 * Audits the DEPLOYED response headers, which is the only place several classes
 * of defect are visible: a platform-injected header, a CDN default, an edge
 * config. None of it is in your source, so no amount of code review finds it.
 *
 * Route-class aware, because the same header means different things on a static
 * marketing page, a dynamic app route, and an API route. A scanner that applies
 * API rules to a prerendered homepage generates noise, and noise gets gates
 * disabled (see GATES.md).
 *
 * Exit codes:
 *   0  no findings
 *   1  findings
 *   2  could not run — broken, NOT clean
 *
 * Usage:
 *   check-headers.mjs https://example.com                    # audits /
 *   check-headers.mjs https://example.com /pricing /api/health
 *   check-headers.mjs https://example.com --json
 *   check-headers.mjs https://example.com / --expect headers.expected.json
 *
 * --expect <file> compares the live headers with a committed policy, which
 * catches drift between the repo and whatever layer actually serves the
 * response (a CDN rule, a host dashboard). The file is JSON, header name to
 * expected value; null means the header must be ABSENT, which is how you pin
 * "a preview host sends no framing header":
 *
 *   { "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
 *     "x-frame-options": "DENY" }
 *
 * Route classes come from Next.js / Vercel markers (x-nextjs-prerender,
 * x-vercel-cache). On any other host nothing is marked static, so every non-API
 * route is judged as dynamic. That is correct for an SPA, and stricter than
 * necessary for a static site on another CDN; the report says when it happened.
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');

// Read --expect by hand, and refuse a repeat: with two, a parser that takes the
// first would silently ignore the one the caller appended (known-patterns.md).
const expectAt = argv.flatMap((a, i) => (a === '--expect' ? [i] : []));
if (expectAt.length > 1) {
  console.error('ERROR: --expect given more than once. Refusing to guess which policy you meant.');
  process.exit(2);
}
let expected = null;
if (expectAt.length === 1) {
  const file = argv[expectAt[0] + 1];
  if (!file || file.startsWith('--')) {
    console.error('ERROR: --expect needs a file path.');
    process.exit(2);
  }
  try {
    expected = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`ERROR: could not read --expect file "${file}": ${err.message}`);
    console.error('       Refusing to report a pass against a policy that was never loaded.');
    process.exit(2);
  }
  const ok = expected && typeof expected === 'object' && !Array.isArray(expected) &&
    Object.keys(expected).length > 0 &&
    Object.values(expected).every((v) => v === null || typeof v === 'string');
  if (!ok) {
    console.error(`ERROR: --expect file "${file}" must be a non-empty JSON object of header name to string or null.`);
    process.exit(2);
  }
  expected = Object.fromEntries(Object.entries(expected).map(([k, v]) => [k.toLowerCase(), v]));
}
const positional = argv.filter((a, i) => !a.startsWith('--') && !expectAt.includes(i - 1));
const base = positional[0];
const paths = positional.length > 1 ? positional.slice(1) : ['/'];

if (!base) {
  console.error('ERROR: no base URL.\nUsage: check-headers.mjs https://example.com [paths...]');
  process.exit(2);
}
let origin;
try {
  origin = new URL(base).origin;
} catch {
  console.error(`ERROR: "${base}" is not a valid URL.`);
  process.exit(2);
}

/**
 * Sent on every request so reflected-origin CORS is visible.
 *
 * Without an Origin header a server that echoes the caller's origin back emits
 * no ACAO at all, so the audit could only ever see a literal `*` -- which is
 * the LESS dangerous configuration, because browsers refuse to pair a wildcard
 * with credentials. The genuinely exploitable form was invisible.
 */
const PROBE_ORIGIN = 'https://gauntlet-cors-probe.invalid';

/** Classify a route so findings can be judged in context. */
function classify(path, status, h) {
  // A 3xx has no body, so CSP / frame / referrer checks are meaningless against
  // it -- they would report four findings about a page that was never rendered.
  // Following the redirect instead would be worse: it would audit the target's
  // headers while labelling them with the source path.
  if (status >= 300 && status < 400) return 'redirect';
  if (path.startsWith('/api/')) return 'api';
  if (h.get('x-nextjs-prerender') || /prerender/i.test(h.get('x-vercel-cache') || '')) return 'static';
  return 'dynamic';
}

const findings = [];
const add = (sev, path, id, msg, detail) => findings.push({ sev, path, id, msg, detail });

// Header checks. `applies` gates each one to the route classes where it is
// meaningful — this is what keeps the output actionable.
const CHECKS = [
  {
    id: 'CORS-WILDCARD',
    applies: () => true,
    run(h, path, cls) {
      const acao = h.get('access-control-allow-origin');
      const creds = h.get('access-control-allow-credentials') === 'true';

      // Reflection: the server echoed back the origin we sent. Strictly more
      // dangerous than a wildcard, because browsers DO honour it with cookies.
      if (acao === PROBE_ORIGIN || acao === 'null') {
        add(creds ? 'CRITICAL' : 'HIGH', path, 'CORS-REFLECTED',
          `Access-Control-Allow-Origin reflects an arbitrary origin${creds ? ' WITH credentials' : ''}`,
          creds
            ? 'Any site can read this response with the victim’s cookies attached. Allow-list specific origins instead of echoing the request.'
            : 'Any origin can read this response. Credentials are not permitted, but allow-list specific origins rather than echoing the request.');
        return;
      }
      if (acao !== '*') return;
      if (creds) {
        add('CRITICAL', path, 'CORS-WILDCARD',
          'Access-Control-Allow-Origin: * with Allow-Credentials: true',
          'Any origin can read credentialed responses. Browsers normally reject this pairing, but do not rely on that.');
      } else if (cls === 'api' || cls === 'dynamic') {
        add('HIGH', path, 'CORS-WILDCARD',
          'Access-Control-Allow-Origin: * on a non-static route',
          'Any origin can read this response. Credentials are excluded by the wildcard, but bearer-token APIs are still exposed.');
      } else {
        add('LOW', path, 'CORS-WILDCARD',
          'Access-Control-Allow-Origin: * on a static public page',
          'Content is already public and the wildcard forbids credentials, so impact is minimal — but nothing needs cross-origin reads here. Often injected by the host, not your code.');
      }
    },
  },
  {
    id: 'HSTS',
    applies: (cls) => true,
    run(h, path) {
      const v = h.get('strict-transport-security');
      if (!v) return add('MEDIUM', path, 'HSTS', 'Strict-Transport-Security missing');
      const age = /max-age=(\d+)/.exec(v);
      if (!age || Number(age[1]) < 15552000) {
        add('LOW', path, 'HSTS', `HSTS max-age below 180 days (${v})`);
      }
    },
  },
  {
    id: 'CSP',
    applies: (cls) => cls !== 'api' && cls !== 'redirect',
    run(h, path) {
      const v = h.get('content-security-policy');
      // A Report-Only policy enforces nothing, but calling it "missing" hides a
      // staged rollout that is under way. Report what is actually there.
      if (!v && h.get('content-security-policy-report-only')) {
        return add('MEDIUM', path, 'CSP',
          'Content-Security-Policy is report-only (not enforced)',
          'A staged rollout: violations are reported but nothing is blocked. Promote it to Content-Security-Policy once the reports are clean.');
      }
      if (!v) return add('MEDIUM', path, 'CSP', 'Content-Security-Policy missing');
      if (/default-src[^;]*\*/.test(v)) add('MEDIUM', path, 'CSP', "CSP default-src contains a wildcard");
      if (/script-src[^;]*'unsafe-eval'/.test(v)) add('MEDIUM', path, 'CSP', "CSP allows 'unsafe-eval'");
      if (!/frame-ancestors/.test(v)) add('LOW', path, 'CSP', 'CSP has no frame-ancestors directive');
    },
  },
  {
    id: 'NOSNIFF',
    applies: () => true,
    run(h, path) {
      if (h.get('x-content-type-options') !== 'nosniff') {
        add('LOW', path, 'NOSNIFF', 'X-Content-Type-Options: nosniff missing');
      }
    },
  },
  {
    id: 'FRAME',
    applies: (cls) => cls !== 'api' && cls !== 'redirect',
    run(h, path) {
      const xfo = h.get('x-frame-options');
      const csp = h.get('content-security-policy') || '';
      if (!xfo && !/frame-ancestors/.test(csp)) {
        add('MEDIUM', path, 'FRAME', 'No clickjacking protection (neither X-Frame-Options nor frame-ancestors)');
      }
    },
  },
  {
    id: 'REFERRER',
    applies: (cls) => cls !== 'api' && cls !== 'redirect',
    run(h, path) {
      if (!h.get('referrer-policy')) add('LOW', path, 'REFERRER', 'Referrer-Policy missing');
    },
  },
  {
    id: 'CACHE-PRIVATE',
    applies: (cls) => cls === 'dynamic' || cls === 'api',
    run(h, path) {
      const cc = (h.get('cache-control') || '').toLowerCase();
      if (!cc) return;

      // Evaluate the SHARED cache independently of the browser cache. The old
      // predicate required the literal token `public` and treated any
      // `max-age=0` as proof of safety -- so `s-maxage=3600` alone, and
      // `public, max-age=0, s-maxage=600`, both read as clean. That second form
      // is the canonical "don't cache in the browser, do cache at the edge"
      // idiom and is the likeliest real instance of this defect on a CDN.
      const suppressed = /no-store|private|no-cache|s-maxage=0(?!\d)/.test(cc);
      if (suppressed) return;

      const sMaxAge = /s-maxage=([1-9]\d*)/.exec(cc);
      const maxAge = /(?<!s-)max-age=([1-9]\d*)/.exec(cc);

      if (sMaxAge) {
        add('HIGH', path, 'CACHE-PRIVATE',
          `Shared cache may store this route for ${sMaxAge[1]}s (${cc})`,
          'A CDN may serve one user’s response to another. s-maxage targets the shared cache specifically, and max-age=0 does not restrain it.');
      } else if (/public/.test(cc) && maxAge) {
        add('HIGH', path, 'CACHE-PRIVATE',
          `Dynamic/API route is publicly cacheable (${cc})`,
          'A shared cache may serve one user’s response to another.');
      }
    },
  },
  {
    id: 'SERVER-BANNER',
    applies: () => true,
    run(h, path) {
      for (const k of ['x-powered-by', 'x-aspnet-version']) {
        if (h.get(k)) add('LOW', path, 'SERVER-BANNER', `${k} discloses stack version: ${h.get(k)}`);
      }
    },
  },
  {
    id: 'RATELIMIT-HEADERS',
    // Only meaningful where a limit is actually enforced. Flagging their absence
    // on a static page is the canonical false positive for this check.
    applies: (cls) => cls === 'api',
    run(h, path, cls, status) {
      if (status !== 429) return;
      const missing = ['retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining'].filter((k) => !h.get(k));
      if (missing.length) {
        add('LOW', path, 'RATELIMIT-HEADERS',
          `429 without ${missing.join(', ')}`,
          'Auth endpoints are a deliberate exception — per-key reset windows there leak account existence.');
      }
    },
  },
];

// Compare as the browser would: directive order and spacing in a CSP do not
// change its meaning.
const normalize = (name, v) =>
  name === 'content-security-policy' || name === 'content-security-policy-report-only'
    ? v.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean).sort().join('; ')
    : v.trim().replace(/\s+/g, ' ');

function checkExpected(h, path, cls) {
  if (!expected || cls === 'redirect') return;
  for (const [name, want] of Object.entries(expected)) {
    const got = h.get(name);
    if (want === null) {
      if (got !== null) add('MEDIUM', path, 'EXPECT-DRIFT', `${name} is present but the policy says it must be absent`, `Live: ${got}`);
    } else if (got === null) {
      add('MEDIUM', path, 'EXPECT-DRIFT', `${name} is missing but the policy expects it`, `Expected: ${want}`);
    } else if (normalize(name, got) !== normalize(name, want)) {
      add('MEDIUM', path, 'EXPECT-DRIFT', `${name} differs from the committed policy`, `Expected: ${want}\n           Live:     ${got}`);
    }
  }
}

// ── Validate paths ──────────────────────────────────────────────────────────
// Git Bash / MSYS rewrites a bare "/" argument into a Windows filesystem path
// ("C:/Program Files/Git/"). Left unchecked, the audit runs against a mangled
// URL and reports findings — a broken invocation masquerading as a result.
// Refuse instead. Prefix the command with MSYS_NO_PATHCONV=1 on Windows.
for (const p of paths) {
  if (/^[A-Za-z]:[\\/]/.test(p) || p.includes('\\') || p.includes('://')) {
    console.error(`ERROR: "${p}" is not a URL path.`);
    console.error('       On Git Bash / MSYS, a leading "/" is rewritten to a filesystem path.');
    console.error('       Re-run as:  MSYS_NO_PATHCONV=1 check-headers.mjs <url> /path ...');
    console.error('       Refusing to audit a mangled URL.');
    process.exit(2);
  }
}

// ── Fetch ───────────────────────────────────────────────────────────────────
const results = [];
let sawFrameworkMarkers = false;
for (const p of paths) {
  const url = origin + (p.startsWith('/') ? p : `/${p}`);
  let res;
  try {
    res = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'gauntlet-check-headers', origin: PROBE_ORIGIN },
    });
  } catch (err) {
    console.error(`ERROR: request to ${url} failed: ${err.message}`);
    console.error('       Refusing to report a pass on a surface that could not be reached.');
    process.exit(2);
  }
  const cls = classify(p, res.status, res.headers);
  results.push({ path: p, status: res.status, cls });
  for (const c of CHECKS) {
    if (c.applies(cls)) c.run(res.headers, p, cls, res.status);
  }
  checkExpected(res.headers, p, cls);
  if (['x-nextjs-prerender', 'x-vercel-cache', 'x-vercel-id'].some((k) => res.headers.get(k))) {
    sawFrameworkMarkers = true;
  }
}

if (results.length === 0) {
  console.error('ERROR: no routes audited. Refusing to report a pass.');
  process.exit(2);
}

// ── Report ──────────────────────────────────────────────────────────────────
const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
findings.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);

const notes = [];
if (!sawFrameworkMarkers && results.some((r) => r.cls === 'dynamic')) {
  notes.push('No Next.js/Vercel markers seen, so no route could be classed static; non-API routes were judged as dynamic.');
}
if (expected) notes.push(`Compared against ${Object.keys(expected).length} expected header(s) from --expect.`);

if (asJson) {
  console.log(JSON.stringify({ origin, audited: results, notes, findings }, null, 2));
} else {
  console.log(`check-headers: ${origin}\n`);
  for (const r of results) console.log(`  ${String(r.status).padEnd(4)} ${r.cls.padEnd(8)} ${r.path}`);
  console.log('');
  for (const n of notes) console.log(`  note: ${n}`);
  if (notes.length) console.log('');
  if (findings.length === 0) {
    console.log('  no findings');
  } else {
    for (const f of findings) {
      console.log(`  ${f.sev.padEnd(8)} ${f.id.padEnd(18)} ${f.path}`);
      console.log(`           ${f.msg}`);
      if (f.detail) console.log(`           ${f.detail}`);
      console.log('');
    }
  }
}

const blocking = findings.filter((f) => f.sev === 'CRITICAL' || f.sev === 'HIGH');
console.log(
  `${findings.length} finding(s) across ${results.length} route(s) — ` +
    `${blocking.length} blocking (CRITICAL/HIGH).`
);
// exitCode, not exit(): process.exit() with fetch's keep-alive sockets still open
// can abort Node on Windows (0xC0000409), turning every result into a crash.
process.exitCode = findings.length > 0 ? 1 : 0;
