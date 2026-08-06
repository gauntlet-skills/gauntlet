# Build prompt specs

The per-phase specification each build prompt is generated from — what the
prompt must instruct the agent to produce, with the exact values that matter.

Generated from the generator source by `scripts/extract-build-specs.ts`. Feature
phases are not here: there is one per MVP feature (cap 8, numbered from 8) and
each is derived from the app's own spec. Everything below is fixed for every app.

**These are specs, not prompts.** Each one describes what the finished prompt has
to cover. Expand it into a 250–600 word instruction with a numbered file list and
a `### Checkpoint N` after the closing fence — see `prompt-format.md`.

---

## 1 — Spec validation & project setup

This is the spec-validation phase. The body instructs Claude Code to: read the full spec; confirm it is complete for a production SaaS that can safely accept payments; flag security/scalability/legal/compliance gaps as a table; output a FILE LIST grouped by phase; and produce CLAUDE.md + SPEC.md as committed files. NO application code yet. Bake in this app's specific architecture and any account-type/compliance framing. End with a confirmation line. Checkpoint verifies the file list includes the security utilities, auth routes, and domain-specific modules.

## 2a — Project setup

Project setup. The prompt must instruct Claude Code to generate these files (name each; give its key requirements, not its contents): package.json with EXACT pinned deps (from the Tech Stack table) + scripts (dev/build/lint/typecheck/test/env:validate/check:secrets/check:all); tsconfig (strict, noUncheckedIndexedAccess); .env.example (all vars); src/lib/env.ts (Zod server/client schemas; the AI model id from an env var, never hardcoded); scripts/check-secrets.sh; .gitignore; eslint config; next.config.ts (Sentry + security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy; poweredByHeader:false; 'unsafe-eval' in script-src ONLY when NODE_ENV!=='production' — never ship it; and Access-Control-Allow-Origin pinned to the app's own origin plus Vary:Origin, because Vercel injects a wildcard ACAO on statically prerendered responses that no config file reveals); tailwind.config.ts; src/lib/logger.ts (redacts secrets); react-query provider.

## 2b — Security utilities & API foundation

Security utilities & API foundation. The prompt must instruct Claude Code to generate these files (name each; give its key requirements, not its contents): middleware.ts (security headers → CSRF Origin check rejecting missing Origin → auth refresh); supabase client/server/admin; rate-limit.ts (checkAIRateLimit FAIL-CLOSED, checkAPIRateLimit, dual auth limits fail-closed, checkAICostCeiling daily $ ceiling); audit.ts; stripe.ts (PLANS constant); the AI client module — INCLUDE ONLY IF the app has an AI feature (model from env var AI_MODEL, INJECTION_GUARD constant, token cost per call, deprecation error on model-not-found 404, fail-closed); OMIT it entirely (no ai-client file, no AI_MODEL env var) if the spec declares no AI; email.ts (Resend); api-handler.ts (withErrorHandling: body-size → content-type → auth → rate limit → error catch → OwnershipError→404); ownership.ts; subscription.ts (tier gates); src/app/api/health/route.ts; Zod validation schemas.

## 3 — Database schema (shared foundation)

Database schema — the SHARED FOUNDATION. A single supabase/migrations/001_initial.sql with: all ENUMs; a SECURITY DEFINER STABLE helper is_workspace_member(p_workspace_id uuid); the universal backbone tables (RLS on each, every user_id REFERENCES auth.users ... ON DELETE CASCADE): profiles (refs auth.users cascade), workspaces, workspace_members, subscriptions, webhook_events (stripe_event_id UNIQUE), audit_log, login_attempts, projects; AND the app's core entity spine — the primary domain records that MORE THAN ONE feature phase references (derive them from the App Specification's data model; for a research-style app these include the app's "sessions"/"items" record and its "participants"/"subjects" record). Do NOT create tables that belong to a single feature (a feature's own records — consent forms/records, transcription jobs, findings, synthesis runs, exports, redactions — are created in that feature's own migration). RLS: member-scoped tables use is_workspace_member(workspace_id); service-role-only tables (webhook_events, login_attempts) use USING(false); audit_log SELECT for members via is_workspace_member, INSERT service-role only. handle_new_user trigger atomically creates profile + workspace + workspace_members(owner) + trial subscription. Storage buckets (owner-scoped) if the app uploads files. Indexes on every FK and hot column. No SELECT *. Checkpoint verifies is_workspace_member exists, RLS + the helper on every table, cascades, the core entity spine present (every table later phases FK into exists here), no single-feature tables, and the trigger.

## 4 — Types & validation

Types & validation. src/types/database.ts (Row/Insert/Update types + exported const arrays as the source of truth for enums), any domain type modules, and Zod schemas for every input. Ends with npm run typecheck passing clean.

## 5 — Design system & UI components

Design system & UI components. tailwind.config.ts design tokens (from the blueprint's design direction — accent color, density, typography weights), globals.css, the shadcn/ui base components configured to the tokens, and shared components: sidebar/nav, page-container, page-header, stat-card, empty-state (required on every list), status-badge, data-table, plus any domain display components. Ends with build passing.

## 6 — Authentication

Authentication — email + password (NOT magic-link/passwordless unless the App Spec explicitly requires it). Server-side auth routes only, and they MUST match the SPEC file list exactly: /api/auth/signup, /api/auth/login, /api/auth/logout, /api/auth/forgot-password, /api/auth/reset-password, /api/auth/callback — with dual fail-closed rate limiting, account lockout (30 min after 10 fails), anti-enumeration + consistent timing on forgot-password, email verification enforced, Cloudflare Turnstile on signup. Client login + signup pages with password strength + disabled-on-submit. use-user / use-account-type hooks.

## 7 — Layout, navigation & dashboard

Layout, navigation & dashboard. The public marketing landing page (hero + pricing + FAQ), the onboarding flow, the protected app shell + sidebar, and the dashboard showing real value on first login (not an empty nav) with account-type-aware content and empty states. Transactional email templates (React Email): verification, reset, welcome.

## Tail — Stripe subscriptions & webhooks

Stripe subscriptions & webhooks. Reuse the SHARED subscriptions and webhook_events tables from Phase 3 — do NOT re-create them; if extra billing columns are needed, add them with a small ALTER TABLE migration (next number). Routes: /api/stripe/checkout (validate tier via Zod enum, user id in metadata at session + subscription level, trial where applicable), /api/stripe/portal, and /api/stripe/webhook (raw body via request.text(), signature verified, idempotency via webhook_events insert-before-process, all 6 events, cache invalidation before DB update). A billing page showing plan/status/usage.

## Tail — Legal, compliance & GDPR

Legal, compliance & GDPR. Privacy policy (GDPR + CCPA, every third-party sub-processor named, retention periods, contact email), Terms of service (limitation of liability + AS IS warranty in ALL CAPS, acceptable use, AI accuracy disclaimer, governing law noted for attorney review), cookie consent banner, GDPR data export endpoint (explicit SELECT, excludes internal fields, rate-limited 1/hour), and account deletion (typed confirmation, cancels subscription, cascades). Plus any domain-specific in-UI disclaimers the app needs.

## Tail — Polish & integration

Polish & integration. Empty states on every list, loading skeletons, error boundaries (with Sentry capture), a custom 404, mobile responsiveness at 768px, toast notifications on every mutation, robots.txt disallowing private routes. Ends with npm run check:all clean.

## Tail — Testing & CI/CD

Testing & CI/CD. vitest.config.ts (jsdom, coverage thresholds), playwright.config.ts, unit tests for the enforcement modules (rate-limit fail-closed BOTH ways, subscription gates, validation, and — ONLY if the app has an AI feature — the AI two-pass guard), API tests (auth, ownership 404, tier gates), security tests (cross-user RLS isolation), E2E (signup → verify → onboard → core action → paywall → payment). CI is a REQUIRED, fully-specified deliverable — NOT an aspirational bullet: the prompt must spell out .github/workflows/ci.yml concretely — on: push + pull_request to main; actions/checkout + setup-node + npm ci; and a named job with its run commands for EACH stage lint → typecheck → check:secrets → test → build → e2e (e2e gated to the main branch). Never leave CI as "add a CI pipeline" without the actual jobs.

<!-- source-sha256: de625b81e834 -->

That comment is the hash of the source this was built from. Run
`gates/check-extracted.mjs` to verify this file has not been edited since.
