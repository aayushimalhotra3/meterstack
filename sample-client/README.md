# Sample Client

Minimal FastAPI service demonstrating MeterStack integration via API key.

## Configure

Set env:

```
export METERSTACK_API_BASE_URL=http://localhost:8000
export METERSTACK_API_KEY=<raw_api_key>
```

Generate an API key in MeterStack as an owner/admin, then export it here.

## Run

```
uvicorn main:app --reload --port 9000
```

## Try It

```
curl -X POST http://localhost:9000/reports
curl -X GET http://localhost:9000/status
```

The client checks quota for `reports_per_month`, blocks when exceeded, and records usage when allowed.
