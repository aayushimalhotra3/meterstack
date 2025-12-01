# MeterStack Production Readiness Checklist

Documented for MeterStack v1.0.0

## Runtime and Hosting
- Hosting: Render (blueprint in `render.yaml`).
- Services:
  - `meterstack-backend` (web service from Dockerfile).
  - `meterstack-postgres` (managed Postgres).
  - `meterstack-frontend` (static build served via Node).
- Required environment variables:
  - `DATABASE_URL`: Render Postgres connection string.
  - `BILLING_MODE`: `mock` for public demo, `stripe` for real billing.
  - `FRONTEND_BASE_URL`: Deployed frontend base URL for redirects.
  - `SECRET_KEY`: JWT signing secret.
  - Optional: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` for Stripe mode.
  - Optional: `RATE_LIMIT_PER_MIN` to tune client endpoint limits.

## Security
- JWT secret (`SECRET_KEY`) stored in environment, never committed.
- API keys hashed using bcrypt; only prefixes stored for lookup.
- Rate limiting enforced on `/client` endpoints per API key and path.
- No secrets or `.env` files committed; root `.gitignore` ignores env files.

## Data and Reliability
- Migrations: Alembic migrations applied on container startup (`alembic upgrade head`).
- Webhook idempotency: `ProcessedStripeEvent` table keyed by Stripe event id.
- Rollups: daily aggregates are rebuildable; jobs can re-run safely.
- If webhooks temporarily fail: Stripe retries; events recorded only once.

## Monitoring and Alerts (Lightweight)
- Metrics: request latency and counts via `/metrics` module.
- Health: `/health` endpoint returns `{ ok: true }`.
- Logs: JSON logs written to stdout; integrate with Render logs or external logging.
- Uptime: Configure Render health checks or external ping service.

## Known Limitations and Next Steps
- Single region deployment; no multi-region failover.
- Basic rate limiting; no adaptive or behavioral detection.
- Mock billing mode by default; real metered billing not implemented.
- Background processing via simple jobs; workers not horizontally scaled yet.
- No per-tenant schema or RLS isolation in Postgres (exploration planned).

## Deployment Steps
1. Create services from `render.yaml`.
2. Set env vars on backend service.
3. Deploy backend; migrations run on startup.
4. Run demo seed against cloud DB: `python -m meterstack.demo_seed`.
5. Deploy frontend; set `VITE_API_BASE_URL` to backend URL; confirm UI.
6. Smoke test `/health`, login, dashboard, usage charts, API keys.
