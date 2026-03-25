import os
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite:///./test_suite.db"
os.environ["ENABLE_DEV_ENDPOINTS"] = "true"

from meterstack.main import app  # noqa: E402
from meterstack.database import SessionLocal, engine  # noqa: E402
from meterstack.models import Base  # noqa: E402


async def _auth_token(client: AsyncClient) -> str:
    r = await client.post("/auth/signup", json={"tenant_name": "TestCo", "email": "owner@test.co", "password": "pass1234"})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_entitlements_flow():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/entitlements/admin/seed")
        token = await _auth_token(client)
        h = {"Authorization": f"Bearer {token}"}
        await client.post("/billing/admin/dev-subscribe", headers=h, json={"plan_name": "Starter"})
        r = await client.get("/entitlements/", headers=h)
        data = r.json()
        keys = {d["feature_key"] for d in data}
        assert "projects_max" in keys and "api_calls_per_month" in keys
        pm = next(x for x in data if x["feature_key"] == "projects_max")
        assert pm["limit_value"] == 5
        r2 = await client.post("/entitlements/check", headers=h, json={"feature_key": "projects_max"})
        assert r2.json()["allowed"] is True
        r3 = await client.post("/entitlements/check", headers=h, json={"feature_key": "unknown_feature"})
        assert r3.json()["allowed"] is False
