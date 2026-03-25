# MeterStack Demo Script

## Goal

Show that MeterStack is a believable SaaS control-plane product, not just an API collection.

Total time: 3-5 minutes.

## 1. Open With The Problem

“MeterStack is a multi-tenant backend for SaaS billing, entitlements, usage metering, analytics, and service-to-service integrations. The main product idea is that customer apps can ask one system: what plan is this tenant on, what are they allowed to do, and how much have they already used?”

## 2. Log In

Use:

- `demo-owner@meterstack.dev`
- `DemoPass123!`

Land on Dashboard and call out:

- current plan
- billing period
- feature usage totals
- entitlement footprint

## 3. Show Billing

Navigate to Billing.

Talk track:

- plans come from the backend, not hardcoded frontend config
- the public demo runs in `mock` billing mode so reviewers can switch plans instantly
- the backend still supports Stripe test mode locally for checkout + webhook work

If helpful, switch between Starter and Pro and return to Dashboard.

## 4. Show Usage + Analytics

Open Usage and pick `api_calls_per_month`.

Call out:

- current billing period
- daily rollup chart
- total / max / average stats

Explain that writes update `UsageDaily` immediately, so analytics stay fresh without waiting for a repair job.

## 5. Show Entitlements

Open Entitlements and explain:

- each feature is mapped to the active plan
- limits can be capped or unlimited
- this is the same data used by quota checks

## 6. Show API Keys

Open API Keys.

Create a key named `Production backend`.

Call out:

- raw key is revealed once
- stored key is hashed server-side
- active and revoked keys are tracked with `last_used_at`

## 7. Show The Integration Pattern

Option A: explain verbally from the UI.

Option B: run the sample client flow.

Expected pattern:

1. client calls `/client/entitlements/check-quota`
2. if allowed, client performs its work
3. client calls `/client/usage/events`
4. dashboard analytics reflect the new usage

## 8. Close

“The project is intentionally backend-heavy: auth, subscription state, entitlement logic, metering, aggregation, idempotent webhooks, deploy config, and a small product UI to prove the backend is actually usable.”
