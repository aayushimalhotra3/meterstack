# Interview Notes

## What Is MeterStack?

MeterStack is a backend-heavy SaaS infrastructure project that handles:

- tenant-scoped auth
- subscription state
- plan entitlements and quota checks
- usage metering and daily aggregation
- analytics for the current billing period
- API keys for backend-to-backend integrations

There is a React UI on top so the backend is visibly usable, but the project’s center of gravity is still backend systems design.

## Strong Talking Points

- The domain model is relational and queryable, not hidden in JSON blobs.
- Quota checks use the current billing period plus aggregated usage, not ad hoc counters.
- Usage writes update the aggregate table immediately, but rebuild tooling still exists for repair and backfill.
- Stripe webhook handling is idempotent through processed-event tracking.
- The project supports both human auth and service auth.
- Public demo mode is intentionally frictionless through mock billing, while Stripe test mode stays available locally.

## Why It Is Not “Just CRUD”

- Multi-tenant boundaries matter throughout the whole app
- There is real commercial plan logic
- There is write-path aggregation, not just reads
- The client integration pattern models real product usage
- The deployment story, tests, and docs are part of the project

## Tradeoffs To Explain Clearly

- Public demo uses mock billing because portfolio review should be frictionless
- SQLite is the fastest local path, but Postgres is the intended deployed database
- UsageDaily is updated synchronously for freshness; a queue-backed pipeline would be the next scale step
- Rate limiting is intentionally lightweight for now

## “What Would You Improve Next?”

- metered Stripe billing rather than fixed subscription-only plans
- async ingestion for very high usage volume
- stronger observability and external metrics/log sinks
- tenant isolation hardening such as RLS
- invite flows and deeper workspace administration

## One-Sentence Resume Version

Built a multi-tenant SaaS infrastructure platform with FastAPI and React that manages subscriptions, entitlements, usage metering, analytics, and API-key integrations, including idempotent Stripe webhook handling and a deployable product demo.
