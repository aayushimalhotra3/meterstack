import os
from fastapi import FastAPI, HTTPException
import httpx


API_BASE = os.getenv("METERSTACK_API_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("METERSTACK_API_KEY", "")

app = FastAPI()


async def _quota_check(feature_key: str, amount: int) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{API_BASE}/client/entitlements/check-quota",
            json={"feature_key": feature_key, "amount": amount},
            headers={"X-Api-Key": API_KEY},
            timeout=10.0,
        )
        r.raise_for_status()
        return r.json()


async def _record_usage(feature_key: str, amount: int) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{API_BASE}/client/usage/events",
            json={"feature_key": feature_key, "amount": amount},
            headers={"X-Api-Key": API_KEY},
            timeout=10.0,
        )
        r.raise_for_status()
        return r.json()


@app.post("/reports")
async def create_report():
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API key not configured")
    q = await _quota_check("reports_per_month", 1)
    if not q.get("allowed"):
        raise HTTPException(status_code=403, detail="Quota exceeded")
    # simulate work
    await _record_usage("reports_per_month", 1)
    return {"ok": True}


@app.get("/status")
async def status():
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API key not configured")
    q = await _quota_check("reports_per_month", 1)
    return {"quota": q}
