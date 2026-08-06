# During-build spot checks (generated)

Rendered from the generator with a maximal feature set, so every check appears.
Drop the ones a given app does not need — and record that you dropped them.

See `spot-checks.md` for the hand-written guidance on placement and why these
are inline rather than batched.

---

## After prompt 2b

### Spot check — Environment Variable & Secret Audit  *(run now, after setup — and again whenever you add a key)*
```
Review all environment variables in undefined.
1. Move any NEXT_PUBLIC_ variable holding a sensitive credential server-side.
2. Confirm every secret is in env vars, never hardcoded.
3. Verify .env/.env.local are gitignored and .env.example has placeholders only.
4. Bucket .env.example into REQUIRED / REQUIRED FOR SPECIFIC FEATURES / OPTIONAL with comments.
   Flag any REQUIRED var no code reads.
5. Run: npm run check:secrets — report exact output.
```

## After prompt 3

### Spot check — Database Connection Pooling  *(run now, right after the schema phase)*
```
Configure Supabase connection pooling for undefined.
1. Transaction pool mode for serverless functions.
2. DATABASE_URL → Transaction Pooler (port 6543); direct connection (5432) for migrations only.
3. Verify the client is initialized with the pooler URL in production env.
```

## After feature 0

### Spot check — Data Access Layer Audit  *(run now, after your first data-returning API routes)*
```
For every API endpoint in undefined that returns user data:
1. Confirm the query filters by the authenticated user's ID.
2. Confirm a user cannot access another user's records by guessing a UUID.
3. Confirm the error response is 404 (not 403) when ownership fails.
Implement fixes for any endpoint missing ownership verification.
```

## After prompt stripe

### Spot check — Stripe Integration Audit  *(run now, immediately after adding Stripe)*
```
Audit the Stripe integration in undefined.
1. Add idempotency keys to all payment requests (double-click = double charge otherwise).
2. Verify webhook signatures with stripe.webhooks.constructEvent(rawBody, sig, secret) where
   rawBody = await request.text() (NOT request.json()).
3. Webhook idempotency: INSERT ... ON CONFLICT DO NOTHING RETURNING id. If no row (conflict):
   SELECT status; if 'processed' return 200; if 'received' (prior attempt failed mid-processing)
   re-process or return 500 so Stripe retries. Flip 'received'→'processed' only after success.
4. Handle all 6 events: checkout.session.completed, customer.subscription.created/updated/deleted,
   invoice.payment_failed, invoice.paid.
5. Test cards: 4242… (success), 4000…0002 (declined), 4000…3184 (3DS), 4000…9995 (insufficient).
Confirm correct application state after each scenario.
```

<!-- source-sha256: 5c5d8506ffd4 -->

That comment is the hash of the source this was built from. Run
`gates/check-extracted.mjs` to verify this file has not been edited since.
