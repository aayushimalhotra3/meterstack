import uuid
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session

from .database import SessionLocal, engine
from .models import Tenant, User, UserRole, Plan, BillingInterval, Feature, PlanFeature, Subscription, SubscriptionStatus, UsageEvent
from .auth import hash_password
from .jobs.usage_rollup import rebuild_daily_usage_for_range


def _get_or_create_tenant_and_owner(db: Session) -> tuple[Tenant, User]:
    t = db.query(Tenant).filter(Tenant.name == "MeterStack Demo").first()
    if not t:
        t = Tenant(name="MeterStack Demo")
        db.add(t)
        db.flush()
    u = db.query(User).filter(User.email == "demo-owner@meterstack.dev").first()
    if not u:
        u = User(tenant_id=t.id, email="demo-owner@meterstack.dev", hashed_password=hash_password("DemoPass123!"), role=UserRole.owner)
        db.add(u)
        db.flush()
    return t, u


def _get_or_create_plans_features(db: Session) -> tuple[Plan, Plan]:
    starter = db.query(Plan).filter(Plan.name == "Starter").first()
    if not starter:
        starter = Plan(name="Starter", description="Starter", billing_interval=BillingInterval.monthly, base_price_cents=1000)
        db.add(starter)
        db.flush()
    pro = db.query(Plan).filter(Plan.name == "Pro").first()
    if not pro:
        pro = Plan(name="Pro", description="Pro", billing_interval=BillingInterval.monthly, base_price_cents=3000)
        db.add(pro)
        db.flush()

    def _feat(key: str, name: str) -> Feature:
        f = db.query(Feature).filter(Feature.key == key).first()
        if not f:
            f = Feature(key=key, name=name)
            db.add(f)
            db.flush()
        return f

    projects = _feat("projects_max", "Projects Max")
    api_calls = _feat("api_calls_per_month", "API Calls per Month")
    reports = _feat("reports_per_month", "Reports per Month")

    def _ensure_pf(plan_id: uuid.UUID, feature_id: uuid.UUID, limit_value: int | None) -> None:
        pf = db.query(PlanFeature).filter(PlanFeature.plan_id == plan_id, PlanFeature.feature_id == feature_id).first()
        if not pf:
            pf = PlanFeature(plan_id=plan_id, feature_id=feature_id, limit_value=limit_value)
            db.add(pf)
        else:
            pf.limit_value = limit_value
            db.add(pf)

    _ensure_pf(starter.id, projects.id, 5)
    _ensure_pf(starter.id, api_calls.id, 10000)
    _ensure_pf(starter.id, reports.id, 20)
    _ensure_pf(pro.id, projects.id, 50)
    _ensure_pf(pro.id, api_calls.id, 100000)
    _ensure_pf(pro.id, reports.id, None)
    db.commit()
    return starter, pro


def _ensure_active_subscription(db: Session, tenant: Tenant, plan: Plan) -> None:
    now = datetime.utcnow()
    sub = db.query(Subscription).filter(Subscription.tenant_id == tenant.id).first()
    if sub:
        sub.plan_id = plan.id
        sub.status = SubscriptionStatus.active
        sub.current_period_start = now
        sub.current_period_end = now + timedelta(days=30)
        sub.cancel_at_period_end = False
        db.add(sub)
        db.commit()
        return
    new_sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        stripe_subscription_id="demo_sub",
        status=SubscriptionStatus.active,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        cancel_at_period_end=False,
    )
    db.add(new_sub)
    db.commit()


def _generate_usage(db: Session, tenant: Tenant) -> None:
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=29)
    db.query(UsageEvent).filter(UsageEvent.tenant_id == tenant.id, UsageEvent.occurred_at >= datetime.combine(start_date, datetime.min.time()), UsageEvent.occurred_at <= datetime.combine(end_date, datetime.max.time())).delete()
    db.commit()
    cur = start_date
    idx = 0
    while cur <= end_date:
        base_calls = 100 + idx * 50
        burst_reports = 0
        if idx % 5 == 0:
            burst_reports = 2
        ev1 = UsageEvent(tenant_id=tenant.id, user_id=None, feature_key="api_calls_per_month", amount=base_calls, occurred_at=datetime.combine(cur, datetime.min.time()))
        rows = [ev1]
        if burst_reports:
            rows.append(UsageEvent(tenant_id=tenant.id, user_id=None, feature_key="reports_per_month", amount=burst_reports, occurred_at=datetime.combine(cur, datetime.min.time())))
        db.add_all(rows)
        db.commit()
        cur = cur + timedelta(days=1)
        idx += 1
    rebuild_daily_usage_for_range(db, start_date, end_date)


def main() -> None:
    db: Session = SessionLocal()
    try:
        from .models import Base
        try:
            Base.metadata.create_all(bind=engine)
        except Exception:
            pass
        t, _ = _get_or_create_tenant_and_owner(db)
        _, pro = _get_or_create_plans_features(db)
        _ensure_active_subscription(db, t, pro)
        _generate_usage(db, t)
    finally:
        db.close()


if __name__ == "__main__":
    main()
