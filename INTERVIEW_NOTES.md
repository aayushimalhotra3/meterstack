# Interview Prep Notes

## What is MeterStack?

- Multi-tenant backend for subscriptions, entitlements, usage, and analytics.
- Stripe integration with checkout and webhooks (idempotent processing).
- Quota enforcement using entitlements + usage aggregation.
- API-key client endpoints for service-to-service integration and demo client.

## Data Model Design

- Tenants and Users: Separation enables org-level scoping with per-user roles.
- PlanFeature: Explicit relational mapping instead of JSON for queryability and limits.
- UsageEvent + UsageDaily: Raw events for precision; daily aggregates for analytics performance.
- Subscriptions: Link tenants to plans with status and current billing period.

## Stripe Webhooks and Idempotency

- ProcessedStripeEvent table keyed by webhook event ID.
- One logical transaction per event update; safe replays return early.
- Missing mappings (tenant/plan) logged and ignored to avoid incorrect state.

## Entitlements and Quota Enforcement

- Check plan includes feature; read limit.
- Resolve current billing period; sum UsageDaily totals for feature.
- Compare against limit; return allowed/remaining or specific reason (e.g., quota_exceeded).

## What would you improve next?

- Metered billing with Stripe usage-based prices.
- Stronger rate limiting (token bucket per key + burst capacity) and abuse monitoring.
- Enhanced multitenancy isolation (RLS, per-tenant schemas, or connection routing).
- Horizontally scale workers for rollups and add async ingestion for high-volume usage.

## LinkedIn Featured Snippet

Headline: MeterStack – Multi-tenant SaaS billing and usage analytics backend

Built a backend platform that manages multi-tenant subscriptions, entitlements, and feature usage for SaaS apps. The service integrates with Stripe for subscription lifecycle via webhooks, caches subscription state in Postgres, and exposes APIs for entitlement and quota checks. Client apps send usage events which aggregate into daily tables for analytics and dashboards. Includes API key auth for service-to-service calls, background jobs for rollups, and a React dashboard for tenant owners.
