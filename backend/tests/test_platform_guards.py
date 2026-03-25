import os

from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./test_suite.db"
os.environ["ENABLE_DEV_ENDPOINTS"] = "true"
os.environ["BILLING_MODE"] = "mock"

from meterstack.main import app  # noqa: E402
from meterstack.database import engine  # noqa: E402
from meterstack.models import Base  # noqa: E402
import meterstack.dependencies as deps  # noqa: E402


def _reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_cors_allows_frontend_origin():
    _reset_db()
    with TestClient(app) as client:
        response = client.options(
            "/auth/login",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_dev_endpoints_are_hidden_when_disabled():
    _reset_db()
    with TestClient(app) as client:
        original = deps.ENABLE_DEV_ENDPOINTS
        deps.ENABLE_DEV_ENDPOINTS = False
        try:
            response = client.post("/entitlements/admin/seed")
        finally:
            deps.ENABLE_DEV_ENDPOINTS = original
        assert response.status_code == 404
