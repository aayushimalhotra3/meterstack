# MeterStack

Current version: v1.0.0

Multi-tenant SaaS billing and usage tracking with FastAPI and React.

## Overview

MeterStack provides authentication, tenant scoping, Stripe-powered subscriptions, feature entitlements, usage events, daily rollups, and analytics endpoints with a simple React dashboard.

## Architecture

- Backend: FastAPI (Python), SQLAlchemy ORM, Alembic migrations
- Database: Postgres (Docker), SQLite for local dev
- Queue: Redis + RQ (optional dev)
- Billing: Stripe checkout + webhooks
- Frontend: React + TypeScript (Vite)
-
Flow:
- Tenant signup → JWT
- Stripe checkout → webhook updates `Subscription`
- Usage events → `UsageDaily` rollups → analytics endpoints → dashboard

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Postgres, Redis, Stripe
- Frontend: React, TypeScript
- Infra: Docker Compose, GitHub Actions

## Tech Highlights

- Multi-tenant schema with SQLAlchemy models and Alembic migrations
- Stripe billing integration and idempotent webhooks
- Entitlements and quota-aware checks
- Usage aggregation with daily rollups and analytics
- API keys for service-to-service integration
- Tests, metrics, Docker, CI

## Screenshots

**Dashboard (plan & usage overview)**
![MeterStack dashboard](docs/dashboard.png)

**Usage chart per feature**
![MeterStack usage chart](docs/usage-chart.png)

**Billing / API Keys (optional)**
![MeterStack billing](docs/billing.png)

## Setup

Clone:

```
git clone <repo-url>
cd meterstack
```

Env vars (create `.env` in `backend/`):

```
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/meterstack
REDIS_URL=redis://localhost:6379/0
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_BASE_URL=http://localhost:5173
SYSTEM_ADMIN_EMAIL=owner@example.com
```

Frontend env (`frontend/.env`):

```
VITE_API_BASE_URL=http://localhost:8000
VITE_STARTER_PLAN_ID=price_...
VITE_PRO_PLAN_ID=price_...
```

Run Docker Compose:

```
docker compose up --build
```

Migrations:

```
cd backend
alembic -c alembic.ini upgrade head
```

Tests:

```
pytest -q backend/tests
```

## Example Usage

Signup:

```
curl -X POST http://localhost:8000/auth/signup -H 'Content-Type: application/json' -d '{"tenant_name":"Acme","email":"owner@acme.com","password":"pass1234"}'
```

Login:

```
curl -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' -d '{"email":"owner@acme.com","password":"pass1234"}'
```

Create checkout session:

```
curl -X POST http://localhost:8000/billing/create-checkout-session -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{"plan_id":"<uuid>"}'
```

Post usage event:

```
curl -X POST http://localhost:8000/usage/events -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{"feature_key":"api_calls_per_month","amount":10}'
```

Read analytics summary:

```
curl -X GET http://localhost:8000/analytics/summary -H 'Authorization: Bearer <token>'
```

## API Keys Integration

Create an API key:

```
curl -X POST http://localhost:8000/api-keys -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{"name":"Backend Service"}'
```

Use API key for service-to-service calls:

```
# Quota-aware check
curl -X POST http://localhost:8000/client/entitlements/check-quota \
  -H 'X-Api-Key: <raw_api_key>' -H 'Content-Type: application/json' \
  -d '{"feature_key":"api_calls_per_month","amount":100}'

# Record usage event (optional quota enforcement)
curl -X POST http://localhost:8000/client/usage/events \
  -H 'X-Api-Key: <raw_api_key>' -H 'Content-Type: application/json' \
  -d '{"feature_key":"api_calls_per_month","amount":10}'
```

## CI

GitHub Actions workflow runs backend tests and frontend lint on push/PR to main.

## Quickstart (Demo Mode)

1. Clone and prepare env:

```
git clone <repo-url>
cd meterstack
cp backend/.env.example backend/.env
```

2. Fill backend `.env`:

- `DATABASE_URL` pointing to local Postgres or SQLite
- `FRONTEND_BASE_URL` set to `http://localhost:5173`
- `BILLING_MODE=mock` to avoid Stripe in demo

3. Start local services and backend:

```
docker compose up -d db redis
cd backend && pip install -r requirements.txt
alembic -c alembic.ini upgrade head
python -m meterstack.demo_seed
uvicorn meterstack.main:app --reload
```

4. Start frontend:

```
cd frontend
npm install
npm run dev
```

5. Demo login:

- Email: `demo-owner@meterstack.dev`
- Password: `DemoPass123!`

Navigate dashboard, usage, and billing. In mock mode, checkout returns a dummy URL and subscriptions are set without Stripe.

## Deployment (Optional)

Render blueprint `render.yaml` included for a simple deployment:

- Backend service built from `backend/Dockerfile`
- Managed Postgres database
- Frontend built with `npm run build` and served as static files

Steps:

- Set env vars: `DATABASE_URL`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_BASE_URL`, `BILLING_MODE` (`stripe` for production)
- Deploy backend and frontend
- Run `alembic upgrade head`
- Optionally run `python -m meterstack.demo_seed` for demo data (skip if using Stripe in production)

## Demo Script

1. Log in with `demo-owner@meterstack.dev` / `DemoPass123!`
2. Open Billing to see current plan (Pro) and period dates
3. Open Analytics to view usage summary and timeseries
4. Generate more usage via API:

```
curl -X POST http://localhost:8000/client/usage/events \
  -H 'X-Api-Key: <raw_api_key>' -H 'Content-Type: application/json' \
  -d '{"feature_key":"api_calls_per_month","amount":250}'
```

5. Refresh dashboard to see updated usage. In Stripe mode, run checkout and observe subscription updates.

## Performance

- Load test script at `backend/load_test/simulate_usage.py` fires concurrent usage events against API-key protected client endpoints.
- On local dev (SQLite, 500–2000 events, concurrency 20–50) observed roughly:
  - p50: 8–15 ms
  - p95: 30–60 ms
  - max: 100–180 ms
- Bottlenecks and tweaks:
  - Added composite indexes on `usage_events(tenant_id,feature_key,occurred_at)`, `usage_daily(tenant_id,feature_key,date)`, and `subscriptions(tenant_id,status)`.
  - Simple in-memory rate limiting for client endpoints to mitigate burst abuse.
  - Rollup jobs commit per day and log updates; can be moved to background worker for sustained load.

## Security and Design Considerations

- Webhooks: stored `ProcessedStripeEvent` to ensure idempotency.
- API keys: raw keys never logged; stored with bcrypt `key_hash` and prefix lookup for fast candidate selection.
- Input validation: Pydantic models enforce lengths and positive integers.
- Rate limiting: per-API-key, per-endpoint sliding window limiter on client routes.

## Sample Client

- A minimal FastAPI service in `sample-client/` shows a SaaS backend calling MeterStack.
- Configure `METERSTACK_API_BASE_URL` and `METERSTACK_API_KEY`, then run `uvicorn main:app`.
- `POST /reports` checks quota for `reports_per_month` and records usage; `GET /status` returns current quota check.

#### For recruiters / reviewers

- Demonstrates a complete multi-tenant SaaS backend with plans, features, subscriptions, entitlements, and quotas.
- Integrates Stripe for subscription lifecycle via checkout and webhooks with idempotent event processing.
- Tracks feature usage as events and aggregates to daily tables, powering analytics, quota checks, and dashboards.
- Supports both user JWT and API key auth so external apps integrate via `/client` endpoints.
- Includes tests, rate limiting, metrics endpoint, Docker Compose, and CI — mirroring production service patterns.

## Demo

- Live demo script: see `DEMO_SCRIPT.md` for a concise 2–4 minute walkthrough.
- Public demo (mock billing mode): add your deployed URL here once live.
- Optional recording: add a screen capture link here if available.
  
  **Quick demo GIF (optional)**
  
  ![MeterStack demo](docs/demo.gif)
