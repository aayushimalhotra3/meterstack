from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid

from .dependencies import get_db, get_current_user, get_current_tenant, ensure_dev_endpoints_enabled
from .models import Plan, Tenant, User, UserRole, Subscription, SubscriptionStatus, ProcessedStripeEvent, BillingInterval
from .billing.stripe_client import get_stripe
from .config import FRONTEND_BASE_URL, STRIPE_WEBHOOK_SECRET, BILLING_MODE
from .observability import log_json

router = APIRouter(prefix="/billing")


class CheckoutRequest(BaseModel):
    plan_id: str


class PlanResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    billing_interval: BillingInterval
    base_price_cents: int
    is_current: bool


@router.post("/create-checkout-session")
def create_checkout_session(body: CheckoutRequest, user: User = Depends(get_current_user), tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    try:
        plan_uuid = uuid.UUID(body.plan_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan id")

    plan = db.query(Plan).filter(Plan.id == plan_uuid).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    if BILLING_MODE == "mock":
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        sub = db.query(Subscription).filter(Subscription.tenant_id == tenant.id).first()
        if sub:
            sub.plan_id = plan.id
            sub.status = SubscriptionStatus.active
            sub.current_period_start = now
            sub.current_period_end = now + timedelta(days=30)
            sub.cancel_at_period_end = False
            db.add(sub)
        else:
            new_sub = Subscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                stripe_subscription_id=None,
                status=SubscriptionStatus.active,
                current_period_start=now,
                current_period_end=now + timedelta(days=30),
                cancel_at_period_end=False,
            )
            db.add(new_sub)
        db.commit()
        return {"url": f"{FRONTEND_BASE_URL}/billing/mock-success"}
    if not plan or not plan.stripe_price_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plan not available for checkout")

    s = get_stripe()
    if not s.api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe not configured")

    customer_id = tenant.stripe_customer_id
    if not customer_id:
        owner = db.query(User).filter(User.tenant_id == tenant.id, User.role == UserRole.owner).first()
        email = owner.email if owner else user.email
        customer = s.Customer.create(name=tenant.name, email=email)
        tenant.stripe_customer_id = customer["id"]
        db.add(tenant)
        db.commit()
        customer_id = tenant.stripe_customer_id

    success_url = f"{FRONTEND_BASE_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{FRONTEND_BASE_URL}/billing/cancel"
    session = s.checkout.Session.create(
        customer=customer_id,
        line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return {"url": session.get("url")}


@router.get("/plans", response_model=list[PlanResponse])
def list_plans(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    current_sub = (
        db.query(Subscription)
        .filter(
            Subscription.tenant_id == tenant.id,
            Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trialing]),
        )
        .order_by(Subscription.current_period_start.desc())
        .first()
    )
    current_plan_id = current_sub.plan_id if current_sub else None
    plans = db.query(Plan).order_by(Plan.base_price_cents.asc(), Plan.name.asc()).all()
    return [
        PlanResponse(
            id=str(plan.id),
            name=plan.name,
            description=plan.description,
            billing_interval=plan.billing_interval,
            base_price_cents=plan.base_price_cents,
            is_current=plan.id == current_plan_id,
        )
        for plan in plans
    ]


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    if BILLING_MODE == "mock":
        return {"ok": True}
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature")
    s = get_stripe()
    try:
        event = s.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        return {"ok": True}

    etype = event.get("type")
    event_id = event.get("id")
    if event_id:
        existing = db.query(ProcessedStripeEvent).filter(ProcessedStripeEvent.event_id == event_id).first()
        if existing:
            log_json({"level": "info", "message": "webhook_duplicate", "event_id": event_id, "type": etype})
            return {"ok": True}
        try:
            db.add(ProcessedStripeEvent(event_id=event_id))
            db.commit()
        except Exception:
            log_json({"level": "error", "message": "webhook_event_record_failed", "event_id": event_id})
            return {"ok": True}
    obj = event.get("data", {}).get("object", {})

    def _status_map(sval: str) -> SubscriptionStatus:
        sval = (sval or "").lower()
        if sval in ("active", "trialing", "past_due", "canceled"):
            return SubscriptionStatus[sval]
        return SubscriptionStatus.active

    if etype in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        sub_id = obj.get("id")
        cust_id = obj.get("customer")
        status_val = obj.get("status")
        items = obj.get("items", {}).get("data", [])
        price_id = None
        if items:
            item0 = items[0]
            price = item0.get("price") or {}
            price_id = price.get("id")

        cps = obj.get("current_period_start")
        cpe = obj.get("current_period_end")
        cancel_at_period_end = bool(obj.get("cancel_at_period_end"))

        tenant = db.query(Tenant).filter(Tenant.stripe_customer_id == cust_id).first()
        plan = db.query(Plan).filter(Plan.stripe_price_id == price_id).first() if price_id else None

        if not tenant or not plan:
            log_json({"level": "error", "message": "webhook_missing_mapping", "event_id": event_id, "type": etype})
            return {"ok": True}

        existing_sub = db.query(Subscription).filter(Subscription.stripe_subscription_id == sub_id).first()
        if etype == "customer.subscription.deleted":
            if existing_sub:
                existing_sub.status = SubscriptionStatus.canceled
                db.add(existing_sub)
                db.commit()
                log_json({"level": "info", "message": "subscription_canceled", "tenant_id": str(tenant.id), "sub_id": sub_id})
            return {"ok": True}

        status_enum = _status_map(status_val)
        from datetime import datetime, timezone
        cps_dt = None
        cpe_dt = None
        if isinstance(cps, int):
            cps_dt = datetime.fromtimestamp(cps, timezone.utc)
        if isinstance(cpe, int):
            cpe_dt = datetime.fromtimestamp(cpe, timezone.utc)

        if existing_sub:
            existing_sub.plan_id = plan.id
            existing_sub.status = status_enum
            existing_sub.current_period_start = cps_dt or existing_sub.current_period_start
            existing_sub.current_period_end = cpe_dt or existing_sub.current_period_end
            existing_sub.cancel_at_period_end = cancel_at_period_end
            db.add(existing_sub)
            db.commit()
            log_json({"level": "info", "message": "subscription_updated", "tenant_id": str(tenant.id), "sub_id": sub_id})
        else:
            new_sub = Subscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                stripe_subscription_id=sub_id,
                status=status_enum,
                current_period_start=cps_dt or datetime.now(timezone.utc),
                current_period_end=cpe_dt or datetime.now(timezone.utc),
                cancel_at_period_end=cancel_at_period_end,
            )
            db.add(new_sub)
            db.commit()
            log_json({"level": "info", "message": "subscription_created", "tenant_id": str(tenant.id), "sub_id": sub_id})

    return {"ok": True}


@router.get("/subscription")
def get_subscription(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    sub = db.query(Subscription).filter(Subscription.tenant_id == tenant.id).order_by(Subscription.current_period_start.desc()).first()
    if not sub:
        return {
            "plan": None,
            "status": None,
            "current_period_start": None,
            "current_period_end": None,
            "cancel_at_period_end": False,
        }
    plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
    return {
        "plan": {"name": plan.name if plan else None, "description": plan.description if plan else None},
        "status": sub.status.value,
        "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "cancel_at_period_end": sub.cancel_at_period_end,
    }


class SeedPlansRequest(BaseModel):
    plans: list[dict]


@router.post("/admin/seed-plans")
def seed_plans(db: Session = Depends(get_db)):
    ensure_dev_endpoints_enabled()
    s = get_stripe()
    if not s.api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe not configured")
    plans = db.query(Plan).all()
    for p in plans:
        if p.stripe_product_id and p.stripe_price_id:
            continue
        product = s.Product.create(name=p.name)
        price = s.Price.create(product=product["id"], unit_amount=p.base_price_cents, currency="usd", recurring={"interval": "month"})
        p.stripe_product_id = product["id"]
        p.stripe_price_id = price["id"]
        db.add(p)
    db.commit()
    return {"seeded": True}


class DevSubscribeRequest(BaseModel):
    plan_name: str


@router.post("/admin/dev-subscribe")
def dev_subscribe(body: DevSubscribeRequest, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    ensure_dev_endpoints_enabled()
    plan = db.query(Plan).filter(Plan.name == body.plan_name).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plan not found")
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    sub = db.query(Subscription).filter(Subscription.tenant_id == tenant.id).first()
    if sub:
        sub.plan_id = plan.id
        sub.status = SubscriptionStatus.active
        sub.current_period_start = now
        sub.current_period_end = now + timedelta(days=30)
        sub.cancel_at_period_end = False
        db.add(sub)
        db.commit()
        log_json({"level": "info", "message": "dev_subscribe_update", "tenant_id": str(tenant.id), "plan": plan.name})
        return {"ok": True}
    new_sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        stripe_subscription_id=None,
        status=SubscriptionStatus.active,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        cancel_at_period_end=False,
    )
    db.add(new_sub)
    db.commit()
    log_json({"level": "info", "message": "dev_subscribe_create", "tenant_id": str(tenant.id), "plan": plan.name})
    return {"ok": True}
