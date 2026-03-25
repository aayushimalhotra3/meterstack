import os
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite:///./test_suite.db"
os.environ["ENABLE_DEV_ENDPOINTS"] = "true"
os.environ["BILLING_MODE"] = "mock"

from meterstack.main import app
from meterstack.database import SessionLocal, engine
from meterstack.models import (
    Base,
    Tenant,
    User,
    Plan,
    BillingInterval,
    Subscription,
    SubscriptionStatus,
    UsageDaily,
    ApiKey,
)


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_signup_to_subscription():
    _reset_db()
    with TestClient(app) as client:
        email = f"it_{uuid4()}@example.com"
        r = client.post(
            "/auth/signup",
            json={"tenant_name": f"Acme Co {uuid4()}", "email": email, "password": "Passw0rd!"},
        )
        assert r.status_code == 200
        token = r.json()["access_token"]

    # Create active subscription for the new tenant (bypassing Stripe)
        db = SessionLocal()
        try:
            tenant = db.query(Tenant).join(User, User.tenant_id == Tenant.id).filter(User.email == email).first()
            assert tenant is not None
            plan = db.query(Plan).filter(Plan.name == "Starter").first()
            if not plan:
                plan = Plan(name="Starter", description="Starter", billing_interval=BillingInterval.monthly, base_price_cents=0)
                db.add(plan)
                db.flush()
            now = datetime.now(timezone.utc)
            sub = Subscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                stripe_subscription_id=None,
                status=SubscriptionStatus.active,
                current_period_start=now,
                current_period_end=now + timedelta(days=30),
                cancel_at_period_end=False,
            )
            db.add(sub)
            db.commit()
        finally:
            db.close()

        r2 = client.get("/billing/subscription", headers=_auth_headers(token))
        assert r2.status_code == 200
        data = r2.json()
        assert data["status"] == "active"
        assert data["plan"]["name"] == "Starter"


def test_quota_enforcement_end_to_end():
    _reset_db()
    with TestClient(app) as client:
        email = f"qe_{uuid4()}@example.com"
        r = client.post(
            "/auth/signup",
            json={"tenant_name": f"Qe Co {uuid4()}", "email": email, "password": "Passw0rd!"},
        )
        token = r.json()["access_token"]

    # Seed plans/features
        s = client.post("/entitlements/admin/seed")
        assert s.status_code == 200

    # Create active Starter subscription and near-limit usage daily
        db = SessionLocal()
        try:
            tenant = db.query(Tenant).join(User, User.tenant_id == Tenant.id).filter(User.email == email).first()
            plan = db.query(Plan).filter(Plan.name == "Starter").first()
            now = datetime.now(timezone.utc)
            sub = Subscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                stripe_subscription_id=None,
                status=SubscriptionStatus.active,
                current_period_start=now,
                current_period_end=now + timedelta(days=30),
                cancel_at_period_end=False,
            )
            db.add(sub)
            db.add(UsageDaily(tenant_id=tenant.id, feature_key="api_calls_per_month", date=now.date(), total_amount=9990))
            db.commit()
        finally:
            db.close()

    # Allowed within remaining quota
        ok = client.post(
            "/entitlements/check-quota",
            headers=_auth_headers(token),
            json={"feature_key": "api_calls_per_month", "amount": 5},
        )
        assert ok.status_code == 200
        okd = ok.json()
        assert okd["allowed"] is True
        assert okd["remaining"] >= 0

    # Exceeds quota
        bad = client.post(
            "/entitlements/check-quota",
            headers=_auth_headers(token),
            json={"feature_key": "api_calls_per_month", "amount": 20},
        )
        assert bad.status_code == 200
        bdata = bad.json()
        assert bdata["allowed"] is False
        assert bdata["reason"] == "quota_exceeded"


def test_api_key_flow_and_rate_limit():
    _reset_db()
    with TestClient(app) as client:
        email = f"ak_{uuid4()}@example.com"
        r = client.post(
            "/auth/signup",
            json={"tenant_name": f"Ak Co {uuid4()}", "email": email, "password": "Passw0rd!"},
        )
        token = r.json()["access_token"]

    # Seed plans/features and active subscription
        client.post("/entitlements/admin/seed")
        db = SessionLocal()
        try:
            tenant = db.query(Tenant).join(User, User.tenant_id == Tenant.id).filter(User.email == email).first()
            plan = db.query(Plan).filter(Plan.name == "Starter").first()
            now = datetime.now(timezone.utc)
            db.add(
                Subscription(
                    tenant_id=tenant.id,
                    plan_id=plan.id,
                    stripe_subscription_id=None,
                    status=SubscriptionStatus.active,
                    current_period_start=now,
                    current_period_end=now + timedelta(days=30),
                    cancel_at_period_end=False,
                )
            )
            db.commit()
        finally:
            db.close()

    # Create API key
        ck = client.post("/api-keys", headers=_auth_headers(token), json={"name": "Production backend"})
        assert ck.status_code == 200
        key_resp = ck.json()
        api_key = key_resp["api_key"]
        key_id = key_resp["id"]

    # Use API key: record usage
        ue = client.post(
            "/client/usage/events",
            headers={"X-Api-Key": api_key},
            json={"feature_key": "api_calls_per_month", "amount": 1},
        )
        assert ue.status_code == 200

    # Check quota
        cq = client.post(
            "/client/entitlements/check-quota",
            headers={"X-Api-Key": api_key},
            json={"feature_key": "api_calls_per_month", "amount": 1},
        )
        assert cq.status_code == 200

    # last_used_at updated
        db = SessionLocal()
        try:
            from uuid import UUID
            rec = db.query(ApiKey).filter(ApiKey.id == UUID(key_id)).first()
            assert rec is not None
            assert rec.last_used_at is not None
        finally:
            db.close()

    # Rate limit: temporarily set low threshold
        import meterstack.dependencies as deps
        deps.RATE_LIMIT_PER_MIN = 3
        codes = []
        for _ in range(5):
            resp = client.post(
                "/client/usage/events",
                headers={"X-Api-Key": api_key},
                json={"feature_key": "api_calls_per_month", "amount": 1},
            )
            codes.append(resp.status_code)
        assert 429 in codes


def test_billing_plans_and_mock_checkout_flow():
    _reset_db()
    with TestClient(app) as client:
        seed = client.post("/entitlements/admin/seed")
        assert seed.status_code == 200

        email = f"billing_{uuid4()}@example.com"
        signup = client.post(
            "/auth/signup",
            json={"tenant_name": f"Billing Co {uuid4()}", "email": email, "password": "Passw0rd!"},
        )
        token = signup.json()["access_token"]
        headers = _auth_headers(token)

        plans = client.get("/billing/plans", headers=headers)
        assert plans.status_code == 200
        plan_rows = plans.json()
        assert {plan["name"] for plan in plan_rows} >= {"Starter", "Pro"}

        pro_plan = next(plan for plan in plan_rows if plan["name"] == "Pro")
        checkout = client.post(
            "/billing/create-checkout-session",
            headers=headers,
            json={"plan_id": pro_plan["id"]},
        )
        assert checkout.status_code == 200
        assert checkout.json()["url"].endswith("/billing/mock-success")

        subscription = client.get("/billing/subscription", headers=headers)
        assert subscription.status_code == 200
        assert subscription.json()["plan"]["name"] == "Pro"
        refreshed_plans = client.get("/billing/plans", headers=headers).json()
        assert any(plan["name"] == "Pro" and plan["is_current"] for plan in refreshed_plans)


def test_usage_events_refresh_analytics_immediately():
    _reset_db()
    with TestClient(app) as client:
        client.post("/entitlements/admin/seed")
        email = f"usage_{uuid4()}@example.com"
        signup = client.post(
            "/auth/signup",
            json={"tenant_name": f"Usage Co {uuid4()}", "email": email, "password": "Passw0rd!"},
        )
        token = signup.json()["access_token"]
        headers = _auth_headers(token)
        client.post("/billing/admin/dev-subscribe", headers=headers, json={"plan_name": "Starter"})

        usage = client.post(
            "/usage/events",
            headers=headers,
            json={"feature_key": "api_calls_per_month", "amount": 25},
        )
        assert usage.status_code == 200

        summary = client.get("/analytics/summary", headers=headers)
        assert summary.status_code == 200
        totals = {row["feature_key"]: row["total_amount"] for row in summary.json()["usage"]}
        assert totals["api_calls_per_month"] == 25


def test_api_key_revoke_blocks_client_access():
    _reset_db()
    with TestClient(app) as client:
        client.post("/entitlements/admin/seed")
        email = f"revoke_{uuid4()}@example.com"
        signup = client.post(
            "/auth/signup",
            json={"tenant_name": f"Revoke Co {uuid4()}", "email": email, "password": "Passw0rd!"},
        )
        token = signup.json()["access_token"]
        headers = _auth_headers(token)
        client.post("/billing/admin/dev-subscribe", headers=headers, json={"plan_name": "Starter"})

        created = client.post("/api-keys", headers=headers, json={"name": "Worker"})
        api_key = created.json()["api_key"]
        key_id = created.json()["id"]

        revoke = client.post(f"/api-keys/{key_id}/revoke", headers=headers)
        assert revoke.status_code == 200

        denied = client.post(
            "/client/usage/events",
            headers={"X-Api-Key": api_key},
            json={"feature_key": "api_calls_per_month", "amount": 1},
        )
        assert denied.status_code == 401
