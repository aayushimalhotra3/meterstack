# MeterStack Production Checklist

This project is meant to be publicly demoable first and production-flavored second. The list below is the minimum bar for a credible hosted deployment.

## Runtime

- Backend deployed with Postgres, not SQLite
- Frontend built with `VITE_API_BASE_URL` pointing at the deployed backend
- `SECRET_KEY` set to a strong value
- `ALLOWED_ORIGINS` includes the deployed frontend URL
- `BILLING_MODE=mock` for the public portfolio demo
- `ENABLE_DEV_ENDPOINTS=false`

## Optional Stripe Test Mode

If you want local or private-review Stripe behavior:

- `BILLING_MODE=stripe`
- `STRIPE_API_KEY` set
- `STRIPE_WEBHOOK_SECRET` set
- plans seeded with Stripe price IDs or created via the admin seed helper in local dev

Do not require Stripe for the public demo path.

## Data Prep

- Run migrations: `alembic -c backend/alembic.ini upgrade head`
- Run demo seed: `python -m meterstack.demo_seed`
- Confirm the demo owner can log in
- Confirm Starter and Pro plans exist

## Smoke Test Before Sharing

- signup works for a brand-new tenant
- demo login works
- billing page loads plans
- mock plan switch updates the subscription
- dashboard shows current billing period
- usage page renders a timeseries
- API keys page can create and revoke a key
- sample client or curl flow updates analytics
- `/health` returns `{ "ok": true }`

## Public Demo Guardrails

- keep seeded demo data believable but non-sensitive
- do not expose dev-only endpoints publicly
- keep rate limiting enabled for `/client/*`
- use mock billing on the public URL to prevent reviewer friction

## Nice-To-Have Later

- dedicated worker for repair/backfill jobs
- richer observability sink beyond in-memory metrics
- stronger API key rate limiting or abuse monitoring
- per-tenant isolation enhancements such as RLS or schema isolation
