# Changelog

## v1.1.0

- Standardized the backend as an installable package for local dev and CI.
- Added CORS configuration via `ALLOWED_ORIGINS`.
- Added `ENABLE_DEV_ENDPOINTS` gating for local-only operational helpers.
- Added `GET /billing/plans` and moved billing plan discovery to the backend.
- Switched usage ingestion to update `UsageDaily` immediately on accepted writes.
- Added API key management UI and billing result pages.
- Reworked the dashboard, usage, billing, and entitlements screens into a polished, responsive product demo.
- Expanded demo seed data with realistic plans, usage history, and seeded API key inventory.
- Updated Docker, Render, CI, and docs to match the shipped app behavior.

## v1.0.0

- Initial public release of MeterStack.
