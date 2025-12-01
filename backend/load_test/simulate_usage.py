import os
import asyncio
from datetime import datetime
import random
import time
import httpx


API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY", "")


async def _post_usage(client: httpx.AsyncClient, feature_key: str, amount: int, enforce_quota: bool = False) -> float:
    t0 = time.time()
    r = await client.post(
        f"{API_BASE}/client/usage/events",
        json={"feature_key": feature_key, "amount": amount},
        headers={"X-Api-Key": API_KEY},
        params={"enforce_quota": str(enforce_quota).lower()},
        timeout=10.0,
    )
    r.raise_for_status()
    return (time.time() - t0) * 1000.0


async def _check_quota(client: httpx.AsyncClient, feature_key: str, amount: int) -> dict:
    r = await client.post(
        f"{API_BASE}/client/entitlements/check-quota",
        json={"feature_key": feature_key, "amount": amount},
        headers={"X-Api-Key": API_KEY},
        timeout=10.0,
    )
    r.raise_for_status()
    return r.json()


async def run_burst(total: int = 500, concurrency: int = 20, precheck_ratio: float = 0.2) -> None:
    limits = []
    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(concurrency)

        async def worker(i: int) -> float:
            async with sem:
                fk = random.choice(["api_calls_per_month", "reports_per_month"])
                amt = random.choice([1, 2, 5, 10, 25])
                do_precheck = random.random() < precheck_ratio
                if do_precheck:
                    qr = await _check_quota(client, fk, amt)
                    if not qr.get("allowed"):
                        return 0.0
                return await _post_usage(client, fk, amt, enforce_quota=do_precheck)

        tasks = [asyncio.create_task(worker(i)) for i in range(total)]
        durs = await asyncio.gather(*tasks)
        durs = [d for d in durs if d > 0]
        if durs:
            print({
                "count": len(durs),
                "p50_ms": round(sorted(durs)[int(0.5 * len(durs))], 2),
                "p95_ms": round(sorted(durs)[int(0.95 * len(durs))], 2),
                "max_ms": round(max(durs), 2),
            })
        else:
            print({"count": 0})


if __name__ == "__main__":
    total = int(os.getenv("TOTAL", "500"))
    concurrency = int(os.getenv("CONCURRENCY", "20"))
    precheck_ratio = float(os.getenv("PRECHECK_RATIO", "0.2"))
    asyncio.run(run_burst(total=total, concurrency=concurrency, precheck_ratio=precheck_ratio))
