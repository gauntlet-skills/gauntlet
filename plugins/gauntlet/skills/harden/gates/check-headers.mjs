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
 */

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const positional = argv.filter((a) => !a.startsWith('--'));
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

/** Classify a route so findings can be judged in context. */
function classify(path, h) {
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
      if (acao !== '*') return;
      const creds = h.get('access-control-allow-credentials') === 'true';
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
    applies: (cls) => cls !== 'api',
    run(h, path) {
      const v = h.get('content-security-policy');
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
    applies: (cls) => cls !== 'api',
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
    applies: (cls) => cls !== 'api',
    run(h, path) {
      if (!h.get('referrer-policy')) add('LOW', path, 'REFERRER', 'Referrer-Policy missing');
    },
  },
  {
    id: 'CACHE-PRIVATE',
    applies: (cls) => cls === 'dynamic' || cls === 'api',
    run(h, path) {
      const cc = h.get('cache-control') || '';
      if (/public/.test(cc) && !/no-store|private|max-age=0/.test(cc)) {
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
for (const p of paths) {
  const url = origin + (p.startsWith('/') ? p : `/${p}`);
  let res;
  try {
    res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'gauntlet-check-headers' } });
  } catch (err) {
    console.error(`ERROR: request to ${url} failed: ${err.message}`);
    console.error('       Refusing to report a pass on a surface that could not be reached.');
    process.exit(2);
  }
  const cls = classify(p, res.headers);
  results.push({ path: p, status: res.status, cls });
  for (const c of CHECKS) {
    if (c.applies(cls)) c.run(res.headers, p, cls, res.status);
  }
}

if (results.length === 0) {
  console.error('ERROR: no routes audited. Refusing to report a pass.');
  process.exit(2);
}

// ── Report ──────────────────────────────────────────────────────────────────
const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
findings.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);

if (asJson) {
  console.log(JSON.stringify({ origin, audited: results, findings }, null, 2));
} else {
  console.log(`check-headers: ${origin}\n`);
  for (const r of results) console.log(`  ${String(r.status).padEnd(4)} ${r.cls.padEnd(8)} ${r.path}`);
  console.log('');
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
process.exit(findings.length > 0 ? 1 : 0);
