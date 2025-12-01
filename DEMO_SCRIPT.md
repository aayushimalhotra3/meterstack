# MeterStack Demo Script (2–4 minutes)

## Context (30s)

MeterStack is a multi-tenant SaaS billing and usage analytics backend built with FastAPI, Postgres, Stripe, and React. It manages plans, subscriptions, entitlements, and feature usage for customer apps.

## Tenant Signup and Login (30–45s)

- Open the Login page.
- Either log in with demo owner: `demo-owner@meterstack.dev` / `DemoPass123!`, or click Signup and create a new tenant.
- After login, land on the dashboard.

## Plan and Subscription (30–45s)

- Navigate to Billing.
- Show current plan and status, with period dates.
- Mention Stripe integration and that demo can run in mock mode.
- In Stripe mode, click "Upgrade" to show the Stripe checkout page (no need to complete).

## Usage and Analytics (60–90s)

- Go to Dashboard: point out current period dates and usage summary table.
- Go to Usage page: choose a feature key (e.g., `api_calls_per_month`).
- Show the daily usage line chart from `UsageDaily` data.
- Trigger synthetic usage:
  - Use the load script: `API_BASE_URL=http://localhost:8000 API_KEY=<key> TOTAL=50 python backend/load_test/simulate_usage.py`.
  - Or call `POST /client/usage/events` with `X-Api-Key`.
- Refresh the chart and highlight the updated data points.

## Integration and API Keys (30–45s)

- Go to API Keys page and show a key named "Production backend".
- Explain client flow:
  - Call `POST /client/entitlements/check-quota` for `reports_per_month` before generating a report.
  - If allowed, call `POST /client/usage/events` to record the action.
- Mention the sample client in `sample-client/` that demonstrates this pattern.

## Close (15–30s)

- Recap: subscriptions via Stripe or mock, entitlements and quotas, usage aggregation, analytics, API keys for service-to-service.
- Point to README sections: Quickstart, API Keys Integration, Sample Client.
