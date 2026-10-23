# Mobile scaffold rubric

**162 items · 11 categories · 4 marked `[Critical]`.**
Analyzer prompt version `v11`.

Generated from the analyzer source by `scripts/extract-rubric.ts`, not
transcribed. Regenerate rather than hand-editing.

<!-- source-sha256: 0825ba8f9087 -->

That comment is the hash of the source this was built from. It changes whenever
the source does, so two copies with the same hash came from the same source. Run
`gates/check-extracted.mjs` to verify this file has not been edited since.

## How to grade

Per item: **PASS** (present and specified) · **CONDITIONAL** (partially present
or underspecified) · **FAIL** (missing or wrong) · **N/A**.

A `[Critical]` item that is not PASS fails its **whole category**.

**Category verdict:** PASS if every applicable item passes · CONDITIONAL if ≥70%
pass and no Critical is missing · FAIL otherwise.
**Overall:** PASS only if all categories PASS · FAIL if any category FAILs or any
Critical item is missing · otherwise CONDITIONAL.

## N/A discipline

This is where grading goes wrong, so the rule is strict — it keeps counts
comparable across re-runs.

- N/A **only** when the underlying capability is structurally absent: AI-security
  items when there is no AI, upload items when there are no uploads, webhook
  items when there are no webhooks.
- The **spec's declared scope** decides applicability, not leftover code. If the
  spec says a capability is unused, its whole category is N/A even if dead
  boilerplate exists.
- A control that is simply missing, weak, or unspecified is **FAIL or
  CONDITIONAL — never N/A**. "Not implemented" is not "not applicable."
- Retention is stricter still: a churn-critical flow the spec never addresses
  (input persistence, trial-end behavior, error UX, empty states) is a **FAIL**.
  Silence means it was not designed.

## Expected scores

A fresh scaffold typically scores in the **50s–60s%**. The bake loop — analyze,
merge fixes, re-analyze, three or four rounds — climbs it. **Aim for ~90, not
100.** Chasing the last points costs more than it returns, and some items are
genuinely N/A for a given app.

Grade as a skeptical auditor whose job is to find problems, not to validate the
work. An audit that finds nothing on a fresh scaffold has not been run properly.

---
### CATEGORY 1: MOBILE AUTHENTICATION & TOKEN SECURITY (18 items)

□ 1.1  Auth tokens stored in expo-secure-store — NOT AsyncStorage, NOT memory-only
□ 1.2  Supabase client initialized with custom SecureStore storage adapter
        (getItem, setItem, removeItem implemented using SecureStore async methods)
□ 1.3  autoRefreshToken: true in Supabase client config
□ 1.4  persistSession: true in Supabase client config
□ 1.5  detectSessionInUrl: false in Supabase client config (prevents URL token leakage)
□ 1.6  Email verification enforced — app features not accessible until email verified
□ 1.7  Unverified users redirected to verify-email screen, not silently let through
□ 1.8  signOut clears ALL SecureStore keys, not just the auth token
□ 1.9  Auth rate limiting on login Edge Function: by IP (specify limit and window)
□ 1.10 Auth rate limiting fail-closed (Redis down = request blocked, not allowed)
□ 1.11 Anti-enumeration on forgot-password (same response for existing and non-existing email)
□ 1.12 Audit logging for: signup, login, login_failed, logout, account_delete,
        subscription_change, data_export (written to audit_log table via service role)
□ 1.13 Supabase admin client (service role) exists in shared Edge Function utility
        — never in client code
□ 1.14 EXPO_PUBLIC_ prefix used ONLY for public keys (Supabase anon key, RevenueCat
        public key, Sentry DSN). No external API keys use EXPO_PUBLIC_ prefix.
□ 1.15 All external API secrets stored in EAS secrets, not in .env files or source
□ 1.16 .env.example contains placeholder names only, never real values
□ 1.17 scripts/check-secrets.sh exists and exits non-zero if key patterns found in src/
□ 1.18 CI pipeline runs check-secrets.sh before build

---

### CATEGORY 2: EDGE FUNCTION SECURITY (16 items)

□ 2.1  withAuth wrapper exists in supabase/functions/_shared/handler.ts
□ 2.2  withAuth handles CORS preflight (OPTIONS) before any auth check
□ 2.3  withAuth returns 401 on missing Authorization header
□ 2.4  withAuth returns 401 on invalid/expired token
□ 2.5  withAuth catches all handler errors and returns generic 500 message
        ("Something went wrong") — never exposes stack traces, column names, or SQL
□ 2.6  withAuth reports unhandled errors to Sentry before returning 500
□ 2.7  withAuth generates a requestId and includes it in error logs for correlation
□ 2.8  ALL Edge Functions use the withAuth wrapper (public endpoints use skipAuth: true)
□ 2.9  Zod validates every Edge Function request body before any processing
□ 2.10 Zod validates every external API response before it is stored or returned
□ 2.11 Rate limiting on food search / external API fallback endpoints (Upstash Redis,
        fail-closed, namespaced keys with project prefix)
□ 2.12 Rate limiting on auth endpoints (Upstash Redis, fail-closed)
□ 2.13 Rate limit keys use project namespace prefix (e.g., pf: not global keys)
□ 2.14 ALL external API calls (Nutritionix, any third-party) go through Edge Functions —
        never called directly from client code
□ 2.15 Nutritionix (or equivalent) API key is NOT in any EXPO_PUBLIC_ variable
□ 2.16 Edge Function secrets set in Supabase Dashboard Edge Function secrets,
        not in project's .env file

---

### CATEGORY 3: DATABASE SECURITY & RLS (15 items)

□ 3.1  RLS enabled on EVERY table — no exceptions
□ 3.2  Service-role-only tables (audit_log, webhook_events, revenuecat_events) have
        USING (false) policy — blocks all non-admin access
□ 3.3  User-data tables have policies scoped to auth.uid() — never trust client-provided IDs
□ 3.4  Shared read-only tables (foods, recipes) have SELECT-only policy for
        authenticated users, no INSERT/UPDATE/DELETE from client
□ 3.5  Subscription/entitlement data written by service role only — never by client
□ 3.6  New user trigger creates ALL required rows atomically
        (profile + goals + streak + pre-populated data in single SECURITY DEFINER function)
□ 3.7  All user-data foreign keys use ON DELETE CASCADE
□ 3.8  All audit/compliance foreign keys use ON DELETE SET NULL
        (audit records survive user deletion)
□ 3.9  Database indexes on all frequently-queried columns (user_id, log_date, foreign keys)
□ 3.10 Full-text search extension installed (pg_trgm or equivalent) before food search is built
□ 3.11 Single migration file runs end-to-end without error (tested in throwaway project)
□ 3.12 Migration is idempotent or has explicit prerequisites documented
□ 3.13 No SELECT * in any Edge Function — all queries use explicit column lists
□ 3.14 Supabase connection pooling mode specified (transaction mode for Edge Functions)
□ 3.15 User A cannot access User B's data (verified by cross-user RLS test in test suite)

---

### CATEGORY 4: REVENUECAT & PAYMENT SECURITY (20 items)

□ 4.1  RevenueCat iOS public key and Android public key are DIFFERENT keys
        (not the same key for both platforms)
□ 4.2  RevenueCat initialized with platform-specific key (Platform.OS check)
□ 4.3  Entitlement identifier hardcoded as a constant, not a magic string
        (e.g., ENTITLEMENT_ID = 'protein_premium')
□ 4.4  useEntitlement hook is FAIL-CLOSED:
        if Purchases.getCustomerInfo() throws → isPremium = false (never true)
□ 4.5  useEntitlement loading state renders locked UI (not unlocked while loading)
□ 4.6  PremiumGate component renders locked state when isPremium is null or undefined
□ 4.7  RevenueCat webhook endpoint exists as Edge Function
□ 4.8  Webhook reads raw body: await req.text() (NOT req.json()) before verification
□ 4.9  Webhook verifies HMAC signature against REVENUECAT_WEBHOOK_SECRET before processing
□ 4.10 Webhook uses timing-safe comparison for signature verification
□ 4.11 Idempotency table exists (revenuecat_events with UNIQUE event_id)
□ 4.12 Idempotency check runs BEFORE any processing (not after)
□ 4.13 Webhook returns 200 for all events including duplicates (RevenueCat retries on non-200)
□ 4.14 Webhook handles ALL required event types:
        INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, PRODUCT_CHANGE
□ 4.15 Paywall includes Apple-required auto-renewal legal language:
        "Payment will be charged to your Apple ID account at confirmation of purchase.
        Subscription automatically renews unless cancelled at least 24 hours before
        the end of the current period."
□ 4.16 Paywall includes Google Play-required subscription terms
□ 4.17 Product IDs in client code match exactly what's configured in RevenueCat dashboard
        (specify how this is verified)
□ 4.18 PURCHASE_CANCELLED error code is handled silently (user cancelled = not an error)
□ 4.19 7-day free trial specified on both monthly and annual products
□ 4.20 Subscription management link exists in Profile (opens App Store / Play Store
        subscription settings — we cannot cancel server-side without RevenueCat management API)

---

### CATEGORY 5: APP STORE & GOOGLE PLAY COMPLIANCE (18 items)

□ 5.1  Bundle ID (iOS) and package name (Android) specified and consistent
□ 5.2  app.json has correct privacyManifests for iOS 17+:
        NSPrivacyAccessedAPICategoryUserDefaults with reason CA92.1 (required for
        expo-secure-store which uses UserDefaults internally)
□ 5.3  Privacy nutrition label data types documented and match actual data collected
        (Health & Fitness, Identifiers, Usage Data — nothing more, nothing less)
□ 5.4  Privacy policy URL specified and accessible WITHOUT authentication
□ 5.5  Terms of service URL specified and accessible WITHOUT authentication
□ 5.6  Medical disclaimer in Terms of Service if app touches health data
□ 5.7  No medical claims in any UI copy (search for: clinically, proven, treats,
        cures, diagnoses, therapeutic, medical advice)
□ 5.8  App age rating declared (4+ for nutrition apps — NOT medical content rating
        which triggers additional review requirements)
□ 5.9  supportsTablet: false in app.json if not optimized for iPad
□ 5.10 deploymentTarget: '16.0' (iOS) specified via expo-build-properties
□ 5.11 targetSdkVersion: 35 (Android) specified via expo-build-properties
□ 5.12 minSdkVersion: 24 (Android) specified
□ 5.13 POST_NOTIFICATIONS permission declared in Android manifest
□ 5.14 Push notification permission requested at earned moment (after first meaningful
        user action) — NEVER on first app launch
□ 5.15 Demo account credentials specified for App Store reviewer
□ 5.16 IAP products submitted for review before binary submission
□ 5.17 google-services.json referenced in Android config (required for push)
□ 5.18 Pre-submission audit prompt exists and covers all items in this category

---

### CATEGORY 6: HEALTH DATA & PRIVACY (12 items)

□ 6.1  No health data (meal content, supplement names, nutrition values, weights)
        appears in Sentry error payloads
□ 6.2  Sentry initialized with maskAllText: true
□ 6.3  Sentry initialized with tracesSampleRate: 0.1 in production (not 1.0)
□ 6.4  Health data not logged to console in production (console.log stripped or guarded)
□ 6.5  GDPR data export endpoint exists (Edge Function)
□ 6.6  Data export uses explicit SELECT — no SELECT * anywhere in export function
□ 6.7  Data export EXCLUDES internal fields: push_tokens, revenuecat_events,
        audit_log ip_address, any service role IDs or keys
□ 6.8  Data export returns downloadable JSON (Content-Disposition: attachment header)
□ 6.9  Account deletion endpoint exists with typed confirmation (z.literal validation)
□ 6.10 Account deletion cascades correctly (all user data deleted via FK CASCADE)
□ 6.11 Account deletion limitation documented if RevenueCat cannot be cancelled
        server-side (user must cancel separately — disclosed in-app)
□ 6.12 If app collects health-related data: medical disclaimer visible on relevant
        screens and non-dismissible

---

### CATEGORY 7: ERROR MONITORING & INFRASTRUCTURE (15 items)

□ 7.1  Sentry React Native configured for client
□ 7.2  Sentry configured for Edge Functions (Deno)
□ 7.3  Sentry DSN stored in EXPO_PUBLIC_SENTRY_DSN (public key — this is correct)
□ 7.4  maskAllText: true in Sentry client config (prevents health data in replays)
□ 7.5  Health check Edge Function exists (public endpoint, no auth required)
□ 7.6  Health check tests both database connectivity AND Redis connectivity
□ 7.7  Health check returns 200 (healthy) or 503 (unhealthy) — not always 200
□ 7.8  Environment variable validation runs at app startup (Zod schema on all
        EXPO_PUBLIC_ vars — app shows error or logs to Sentry if missing)
□ 7.9  Structured logging in Edge Functions (timestamp, level, requestId, message)
        — no raw health data in log output
□ 7.10 React Native error boundary implemented (catches JS errors, reports to Sentry)
□ 7.11 Offline detection implemented (expo-network or NetInfo)
□ 7.12 Offline behavior defined for core user actions (queue or graceful error, not crash)
□ 7.13 Optimistic updates implemented for primary user action (meal logging or equivalent)
        with rollback on failure
□ 7.14 Offline queue uses SecureStore or SQLite — NOT in-memory only
        (survives app restart)
□ 7.15 [NEW] Dev/prod environment separation: configuration is fully env-driven (Zod-validated),
        production secrets via EAS secrets (never committed), separate production instances
        (own Supabase project, Redis database or key prefix, RevenueCat production vs sandbox),
        and NO dev/test config can ship in a production build — a sandbox/test payment key, a
        localhost/dev API URL, or a dev-bypass flag must be rejected before a prod build. Not
        critical on its own, but its absence risks shipping a production app wired to test data.

---

### CATEGORY 8: TESTING & CI/CD (14 items)

□ 8.1  Jest configured with React Native preset (jest-expo or react-native)
□ 8.2  Jest config has path alias resolution (@/ → src/)
□ 8.3  Nutrition/core business logic has unit tests with specific test cases
        (not just "it renders")
□ 8.4  Entitlement fail-closed behavior has explicit test:
        RevenueCat throws → isPremium = false
□ 8.5  Schema validation tests: updateProfileSchema rejects fields that should be rejected
□ 8.6  RLS cross-user test: User A cannot access User B's private data
□ 8.7  Edge Function auth test: missing Authorization → 401
□ 8.8  Edge Function auth test: generic error message on 500 (no stack trace)
□ 8.9  Webhook signature test: invalid signature → 401
□ 8.10 Webhook idempotency test: duplicate event_id → 200, no duplicate row
□ 8.11 Offline queue test: failed sync retains item in queue
□ 8.12 CI pipeline exists (.github/workflows/ci.yml or equivalent)
□ 8.13 CI runs: typecheck (tsc --noEmit), lint, check-secrets, jest --coverage
□ 8.14 Mobile E2E framework specified (Maestro or Detox) with at least one
        flow specified: signup → onboarding → core action

---

### CATEGORY 9: BUILD & DEPLOYMENT (10 items)

□ 9.1  eas.json exists with development, preview, and production profiles
□ 9.2  Production profile has autoIncrement: true (build numbers managed by EAS)
□ 9.3  All production secrets managed via EAS secrets, not .env files
        (list every secret that must be created with eas secret:create)
□ 9.4  Supabase Site URL set to production domain before first real user signup
        (localhost URL causes "refused to connect" on email verification links)
□ 9.5  All Edge Functions deployed before app submitted to stores
        (deployment command documented)
□ 9.6  Supabase auth redirect URL includes app deep link scheme
        (e.g., yourapp://) to handle email link callbacks
□ 9.7  Seed scripts documented and ordered correctly
        (foods → branded foods → recipes, or equivalent)
□ 9.8  Seed scripts are idempotent (safe to run twice without duplicate data)
□ 9.9  Post-build IPA/AAB inspection steps documented
        (verify PrivacyInfo.xcprivacy exists, correct bundle ID, correct push entitlement)
□ 9.10 Version update process documented (how to increment version + build number
        for future updates, TestFlight-first workflow)

---


### CATEGORY 10: DESIGN & UX CRAFT (12 items)

This category applies to any app with a user interface (i.e. essentially all of them). A polished-but-generic app that ignores craft scores poorly here even if it is secure.

□ 10.1  A deliberate type system: a named type scale (sizes, weights, line-heights) applied consistently, and a display + body typeface pairing chosen on purpose — not one default face at arbitrary sizes.
□ 10.2  Visual hierarchy comes from size, weight, tracking, and spacing (not bold-everything); running text stays a comfortable measure (~60–75 characters).
□ 10.3  A chosen palette: neutrals biased toward the accent (never a flat #808080 grey), ONE signature accent used sparingly, and semantic status colors (success/warning/error) kept distinct from the accent.
□ 10.4  Light AND dark themes defined at the token level, each with legible WCAG AA contrast — not a naive color inversion.
□ 10.5  Everything interactive looks interactive: hover/active feedback and a visible keyboard-focus state on every control.
□ 10.6  Every UI state is designed — empty, loading (skeleton/spinner), error, and success — not just the happy path.
□ 10.7  A consistent spacing rhythm from a spacing scale, laid out with container gaps and grid alignment — not ad-hoc one-off margins.
□ 10.8  Depth is deliberate and restrained: borders, shadows, and elevation applied as a consistent system — not drop-shadow soup.
□ 10.9  Motion is purposeful and subtle, and respects prefers-reduced-motion — no gratuitous animation.
□ 10.10  Copy is treated as design material: labels name what the user recognizes, active voice, buttons state what happens, and errors explain how to fix — no lorem, no blanket "Something went wrong".
□ 10.11  Genuinely responsive across sizes/orientations: content never overflows its container (no horizontal page scroll on web; safe-area-aware on native); wide tables/code scroll within their own region.
□ 10.12  [Critical] No AI-generic tells: avoid the templated look — centered-everything, rounded corners on every card, emoji as section headers, unstyled default components, or a lone purple→blue gradient hero. The result must read as a deliberate, brand-specific system a top studio would ship — a $100k build, not an AI default.

---

### CATEGORY 11: RETENTION & CONVERSION UX (12 items)

This category applies to any app with real users and a signup or paywall (i.e. essentially all of them). It scores the product-psychology and reliability choices that decide whether a user activates, converts, and returns — an app can be perfectly secure and well-designed yet still bleed users at the paywall, on a lost form, or at a dead-end error. Judge it from the spec's described flows, states, and copy. A flow the spec never addresses (input persistence, trial-end behavior, error UX, empty states) is a FAIL, not N/A — silence on a churn-critical flow means it was not designed.

□ 11.1  [Critical] The user reaches the core "aha" — sees or experiences real value — BEFORE being asked to pay. The paywall lands at a moment of realized value and is framed as a finish line with the price and trial terms stated, not a cold "premium feature" dead-end.
□ 11.2  No capability rug-pulls: anything a trial or plan grants (downloads, higher limits, a feature) is signposted before it expires — a countdown, banner, or notice — so a capability disappearing is expected, never a silent surprise on the day it lapses.
□ 11.3  [Critical] In-progress user input is never lost: forms, drafts, and multi-step flows persist (localStorage / draft record / server) so a refresh, timeout, error boundary, or accidental navigation does not destroy work, and long async operations are resumable rather than restarted.
□ 11.4  Long operations wait honestly: progress or an elapsed indicator is shown, the UI never appears frozen, stated wait times match reality, and the app never asserts something false (e.g. "your data is safe" for input that was never saved).
□ 11.5  [Critical] Errors are user-facing and actionable: internal/operator details never leak to end users (billing consoles, provider names, stack traces, raw API errors); each message says what happened and the next step; a "processing"/queued state auto-resolves (poll/refresh) or offers a manual retry rather than a dead "check back later".
□ 11.6  Honest affordances: a control's label matches what it does; a link or button that will spend a quota, charge money, or generate billable output says so before the click; dead disabled buttons are replaced with an enabled path forward or a clear stated reason.
□ 11.7  Guided activation: a brand-new zero-state user is pointed at the single first action; empty states teach and link forward; the tier a user signs up on can actually complete the journey the marketing advertises (no bait where the entry tier structurally cannot finish the promised flow).
□ 11.8  Pricing and trial terms are clear at the decision point: the tiers, what each includes, and WHAT HAPPENS WHEN THE TRIAL ENDS are stated plainly; CTAs route to exactly what they promise; no promise-then-cap copy (e.g. "unlimited" when it is actually capped).
□ 11.9  Low-friction entry, visible exit: signup asks only for what is needed; cancellation and downgrade paths are discoverable; irreversible or destructive actions require explicit confirmation — being easy to leave lowers the fear of entering.
□ 11.10  Failures degrade gracefully: rate limits, capacity ceilings, and provider outages present as "here is when/how to proceed" (with retry timing where possible), preserving trust instead of reading as "the app is broken".
□ 11.11  Reasons to return: durable value a user can come back to (saved history, resumable work, meaningful lifecycle and transactional email) — not a one-and-done transaction with no re-engagement path.
□ 11.12  Momentum in multi-step flows: the user can always see where they are and what the next action is; completing a step is acknowledged; no screen is a dead end with no forward path.

---
