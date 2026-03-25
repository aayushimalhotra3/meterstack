import os
import time
from httpx import AsyncClient, ASGITransport
import pytest
from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite:///./test_suite.db"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

from meterstack.main import app  # noqa: E402
from meterstack.database import SessionLocal, engine  # noqa: E402
from meterstack.models import Tenant, Plan, Subscription, ProcessedStripeEvent, BillingInterval, SubscriptionStatus  # noqa: E402
from meterstack.models import Base  # noqa: E402


class _StubStripe:
    class Webhook:
        @staticmethod
        def construct_event(payload, sig, secret):
            now = int(time.time())
            return {
                "id": "evt_test_1",
                "type": "customer.subscription.created",
                "data": {
                    "object": {
                        "id": "sub_test_1",
                        "customer": "cus_test_1",
                        "status": "active",
                        "current_period_start": now,
                        "current_period_end": now + 86400 * 30,
                        "cancel_at_period_end": False,
                        "items": {"data": [{"price": {"id": "price_test_1"}}]},
                    }
                },
            }


@pytest.mark.asyncio
async def test_webhook_idempotency(monkeypatch):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db: Session = SessionLocal()
        try:
            t = Tenant(name="HookCo")
            db.add(t)
            db.flush()
            p = Plan(name="Pro", description="Pro", billing_interval=BillingInterval.monthly, base_price_cents=2900, stripe_price_id="price_test_1")
            db.add(p)
            t.stripe_customer_id = "cus_test_1"
            db.add(t)
            db.commit()
        finally:
            db.close()

        from meterstack import routes_billing as rb
        monkeypatch.setattr(rb, "get_stripe", lambda: _StubStripe())
        monkeypatch.setattr(rb, "BILLING_MODE", "stripe")

        payload = b"{}"
        h = {"Stripe-Signature": "sig_test"}
        r1 = await client.post("/billing/webhook", content=payload, headers=h)
        assert r1.status_code == 200
        r2 = await client.post("/billing/webhook", content=payload, headers=h)
        assert r2.status_code == 200

        db = SessionLocal()
        try:
            subs = db.query(Subscription).filter(Subscription.stripe_subscription_id == "sub_test_1").all()
            assert len(subs) == 1
            assert subs[0].status == SubscriptionStatus.active
        finally:
            db.close()
