# Billing Local Setup

This project now includes a local billing workflow backed by:

- Supabase migrations
- Stripe invoice creation
- a Stripe webhook endpoint at `/api/stripe/webhook`

Use this guide whenever `/admin/billing` or live-session entitlements are not behaving as expected locally.

## Required Environment Variables

Add these to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used by the client app.
- `SUPABASE_SERVICE_ROLE_KEY` is required by server routes that provision billing state.
- `STRIPE_SECRET_KEY` is required for invoice creation.
- `STRIPE_WEBHOOK_SECRET` must match the signing secret from `stripe listen`.

## Local Workflow

1. Start local Supabase:

```bash
npm run supabase:start
```

2. Apply all local migrations from scratch:

```bash
npm run supabase:reset
```

This is the safest local option when schema cache or missing RPC errors appear.

3. Start the app:

```bash
npm run dev
```

4. Start Stripe webhook forwarding in a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

5. Copy the webhook signing secret printed by Stripe CLI into `.env.local` as:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

6. Restart `npm run dev` if you changed `.env.local`.

## Quick Diagnostics

Run:

```bash
npm run billing:doctor
```

This checks whether the expected local env vars are present and whether the billing migration file exists in the repo.

## Common Problems

### Missing RPC or schema cache errors

Typical symptoms:

- `Could not find the function public.admin_list_billing_entitlements...`
- billing workspace loads with an infrastructure warning

Fix:

```bash
npm run supabase:reset
```

If the issue persists, restart the local Supabase stack:

```bash
npm run supabase:stop
npm run supabase:start
```

### Stripe invoice route fails immediately

Check:

- `STRIPE_SECRET_KEY` exists
- `SUPABASE_SERVICE_ROLE_KEY` exists
- the selected organization exists and has billing data access in Supabase

### Webhook receives requests but no entitlement is created

Check:

- `stripe listen` is forwarding to `localhost:3000/api/stripe/webhook`
- `STRIPE_WEBHOOK_SECRET` matches the current `stripe listen` session
- the invoice was actually marked as paid in Stripe
- the order has `billing_order_items`

## Recommended E2E Smoke Test

1. Open `/admin/billing`
2. Select an organization
3. Save a billing email
4. Create a billable order
5. Create the Stripe invoice
6. Open the hosted invoice URL
7. Mark the invoice as paid from Stripe test tooling
8. Confirm:

- `billing_orders.status = paid`
- `billing_orders.provisioned_at` is set
- one or more `billing_entitlements` rows were created

9. Switch to facilitator flow
10. Open `/facilitator/sessions`
11. Create a live session from a scenario
12. Confirm:

- a matching entitlement is consumed or decremented
- the session is created with `session_mode = live`
- `participant_limit` matches the entitlement tier

## Helpful SQL Checks

These are useful in the Supabase SQL editor or local DB shell:

```sql
select id, status, stripe_invoice_id, paid_at, provisioned_at
from public.billing_orders
order by created_at desc;
```

```sql
select id, org_id, title, participant_limit, quantity, remaining_quantity, status
from public.billing_entitlements
order by created_at desc;
```

```sql
select stripe_event_id, event_type, processed_at
from public.billing_webhook_events
order by processed_at desc;
```
