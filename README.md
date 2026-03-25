# MeterStack

MeterStack is a backend-heavy SaaS infrastructure demo for tenant auth, subscriptions, entitlements, usage metering, analytics, and service-to-service API keys.

It is designed to answer a hiring manager’s first question quickly: “Can this person build a real product backend, not just a toy CRUD app?”

## What It Shows

- Multi-tenant auth with tenant-scoped JWT sessions
- Plan-aware entitlements and quota checks
- Usage ingestion with immediate `UsageDaily` rollups
- Stripe-ready billing with a recruiter-friendly `mock` billing mode
- API keys for backend-to-backend integrations
- React dashboard for billing, usage, entitlements, and key management
- Demo seed data, CI, Docker, Render config, and an integration sample client

## Architecture

```mermaid
flowchart LR
    A["Owner logs in"] --> B["FastAPI auth + JWT"]
    B --> C["Tenant-scoped routes"]
    C --> D["Billing state"]
    C --> E["Entitlement checks"]
    C --> F["Usage ingestion"]
    F --> G["UsageEvent"]
    F --> H["UsageDaily"]
    H --> I["Analytics endpoints"]
    I --> J["React dashboard"]
    K["Backend service / worker"] --> L["API key auth"]
    L --> E
    L --> F
```

More detail lives in [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/system-overview.md](docs/system-overview.md).

## Repo Layout

- [backend](backend): FastAPI app, SQLAlchemy models, services, tests, Alembic migrations
- [frontend](frontend): React + Vite tenant dashboard
- [sample-client](sample-client): minimal FastAPI service that uses MeterStack via API key

## Fastest Local Start

This path uses SQLite so you can demo the project without Postgres, Redis, or Stripe.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e backend
cp backend/.env.example backend/.env
python -m meterstack.demo_seed
uvicorn meterstack.main:app --reload
```

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

Demo login:

- Email: `demo-owner@meterstack.dev`
- Password: `DemoPass123!`

## Optional Postgres + Redis Local Setup

If you want the app closer to the deployed shape:

```bash
docker compose up -d db redis
```

Then set `DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/meterstack` in `backend/.env`, reinstall if needed, and run:

```bash
alembic -c backend/alembic.ini upgrade head
python -m meterstack.demo_seed
uvicorn meterstack.main:app --reload
```

## Frontend Pages

- `/dashboard`: current plan, billing period, feature totals, entitlement footprint
- `/usage`: per-feature daily timeseries and aggregate stats
- `/billing`: live subscription status plus plan selection
- `/entitlements`: included features and limits for the current plan
- `/api-keys`: create, reveal once, list, and revoke service keys

## Core Backend Endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `GET /me`
- `GET /billing/plans`
- `POST /billing/create-checkout-session`
- `GET /billing/subscription`
- `GET /entitlements/`
- `POST /entitlements/check-quota`
- `POST /usage/events`
- `GET /analytics/summary`
- `GET /analytics/timeseries`
- `POST /api-keys`
- `GET /api-keys`
- `POST /api-keys/{id}/revoke`
- `POST /client/entitlements/check-quota`
- `POST /client/usage/events`

## API Key Integration Flow

1. Create a key in the UI on `/api-keys`.
2. Your backend calls quota check before doing work.
3. If allowed, it performs the action.
4. It records the usage event back to MeterStack.

The sample client in [sample-client](sample-client) demonstrates exactly that pattern.

## Testing And Verification

CI runs four isolated checks so failures are easier to diagnose:

- backend install smoke
- backend pytest
- backend Postgres migration smoke
- frontend lint + build

Local equivalents:

Backend install smoke:

```bash
python -m pip install -e backend
```

Backend tests:

```bash
pytest -q backend/tests
```

Backend migration smoke:

```bash
cd backend
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/meterstack alembic -c alembic.ini upgrade head
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/meterstack alembic -c alembic.ini current
```

Frontend:

```bash
cd frontend
npm run lint --silent
npm run build
```

Verified flows covered by the suite:

- signup/login/me
- billing plans and mock checkout
- immediate analytics freshness after usage writes
- quota enforcement
- API key create/revoke/client access
- CORS behavior
- dev-endpoint gating
- Stripe webhook idempotency

## Local Config

Backend environment variables:

- `DATABASE_URL`: defaults to `sqlite:///./meterstack_dev.db`
- `BILLING_MODE`: use `mock` for demo mode, `stripe` for real Stripe flows
- `STRIPE_API_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_BASE_URL`
- `ALLOWED_ORIGINS`
- `SECRET_KEY`
- `SYSTEM_ADMIN_EMAIL`
- `RATE_LIMIT_PER_MIN`
- `ENABLE_DEV_ENDPOINTS`

Frontend environment variables:

- `VITE_API_BASE_URL`

## Deployment

Render configuration is included in [render.yaml](render.yaml).

Recommended public-demo setup:

- backend on Render using Postgres
- frontend on Vercel with the `frontend/` directory as the project root
- `BILLING_MODE=mock`
- `ENABLE_DEV_ENDPOINTS=false`
- real `SECRET_KEY`
- correct `VITE_API_BASE_URL` and `ALLOWED_ORIGINS`

Frontend-on-Vercel checklist:

- import the repo and set the Vercel project root to `frontend`
- build command: `npm run build`
- output directory: `dist`
- environment variable: `VITE_API_BASE_URL=https://meterstack.onrender.com`
- keep [frontend/vercel.json](frontend/vercel.json) so SPA routes rewrite to `index.html`

After Vercel gives you the frontend URL, update the Render backend env vars:

- `FRONTEND_BASE_URL=https://<your-vercel-url>`
- `ALLOWED_ORIGINS=https://<your-vercel-url>`

Use Stripe test mode locally when you want to demo checkout and webhook handling with real Stripe objects.

## Demo Flow

The cleanest recruiter walkthrough is:

1. Log in with the demo owner.
2. Open Billing and switch plans in mock mode.
3. Open Dashboard and Usage to show the live analytics view.
4. Create an API key in the UI.
5. Use the sample client or curl to call quota check and usage ingestion.
6. Refresh Usage and show that analytics updated immediately.

There is a ready-made talk track in [DEMO_SCRIPT.md](DEMO_SCRIPT.md).
