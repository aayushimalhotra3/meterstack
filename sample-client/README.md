# Sample Client

This is a tiny FastAPI service that demonstrates the intended MeterStack integration pattern for backend-to-backend usage tracking.

## Configure

Create an API key in MeterStack first, then export:

```bash
export METERSTACK_API_BASE_URL=http://localhost:8000
export METERSTACK_API_KEY=<raw_api_key>
```

## Run

```bash
uvicorn main:app --reload --port 9000
```

## Try It

```bash
curl -X POST http://localhost:9000/reports
curl http://localhost:9000/status
```

What it does:

1. checks quota for `reports_per_month`
2. blocks if the tenant would exceed its plan limit
3. records usage only when the action is allowed
