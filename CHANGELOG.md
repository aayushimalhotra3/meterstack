# Changelog

## v1.0.0

- Initial public release of MeterStack.
- Multi-tenant schema for tenants, users, plans, features, subscriptions, usage events, daily aggregates and API keys.
- Stripe (and mock) billing modes with idempotent webhooks updating local subscription state.
- Entitlements and quota checks backed by usage rollups over the current billing period.
- API key integration for client apps to call `/client/entitlements/check-quota` and `/client/usage/events`.
- React dashboard for plan, usage charts, billing, entitlements and API key management.
- Demo seed, load test script, sample client backend, metrics, basic rate limiting and CI.
