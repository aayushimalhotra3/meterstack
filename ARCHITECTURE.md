# Architecture

Documented for MeterStack v1.0.0

## Overview

MeterStack is a multi-tenant backend for subscriptions, entitlements, usage tracking, and analytics. It integrates with Stripe for billing and exposes API-key protected client endpoints for service-to-service integrations.

## Domain Model

- Tenant: Organization owning users and subscriptions.
- User: Login identity scoped to a tenant with a role.
- Plan: Subscription plan with pricing and interval.
- Feature: Named capability a plan may include with limits.
- PlanFeature: Plan-to-feature mapping with optional limit value.
- Subscription: Active or trialing subscription linking a tenant to a plan and period.
- UsageEvent: Raw usage events (feature_key, amount, occurred_at).
- UsageDaily: Daily aggregated totals per feature per tenant.
- ApiKey: Hashed API key for service-to-service auth with prefix for lookup.
- ProcessedStripeEvent: Records processed webhook event IDs for idempotency.

Relationships: Tenants have Users and Subscriptions; Plans map to Features via PlanFeature; UsageEvent aggregates to UsageDaily; ApiKey associates to Tenant.

## Key Flows

- Signup/Login: Create tenant + owner user on signup; login returns JWT with user/tenant claims.
- Stripe Checkout/Webhooks: Checkout creates sessions; webhooks update Subscription based on Stripe events; idempotency via ProcessedStripeEvent.
- Entitlements/Quota: Check if feature is allowed by plan; compute current period; sum UsageDaily; compare against limit and return remaining.
- Usage Recording/Aggregation: Record UsageEvent on user action; rollup job aggregates into UsageDaily per day.
- Analytics/Dashboard: Summary and timeseries endpoints feed frontend charts for period ranges.
- API Keys: Client services call quota check and usage endpoints using `X-Api-Key` for tenant scoping.

## Technical Choices

- FastAPI + Postgres: Modern Python API stack with strong typing and SQLAlchemy ORM.
- Background Jobs: Simple rollups in-process; ready to move to RQ/Celery for scheduled processing.
- Idempotent Webhooks: Event ID record prevents duplicate processing; cautious mapping when plan/tenant missing.
- API Keys: Bcrypt hashes with prefix lookup; raw keys never stored; single return at creation.
- Rate Limiting: Basic per-API-key limiter to mitigate burst abuse on client routes.

## Tradeoffs and Future Work

- Single DB vs sharding: Single database simplifies operations; future could isolate per-tenant schemas or RLS.
- Queues: Redis + RQ sufficient for demos; production could adopt Celery or cloud queues.
- Rollups: Nightly or hourly jobs reduce write load; near real-time aggregation increases freshness at cost of resources.
- Usage-based Billing: Extend to Stripe metered prices for true usage billing.
