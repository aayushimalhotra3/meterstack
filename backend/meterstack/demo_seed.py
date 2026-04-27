import uuid
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import SessionLocal, engine
from .models import ApiKey, Tenant, User, UserRole, Plan, BillingInterval, Feature, PlanFeature, Subscription, SubscriptionStatus, UsageEvent, UsageDaily
from .auth import hash_password
from .jobs.usage_rollup import rebuild_daily_usage_for_range

DEMO_API_KEY = "meterstack_demo_backend_key_2026"
DEMO_PASSWORD = "DemoPass123!"
SEEDED_DAYS = 30
SEEDED_FEATURE_COUNT = 4
SEEDED_EVENTS_PER_DAY = 7


def _get_or_create_tenant_and_owner(db: Session) -> tuple[Tenant, User]:
    t = db.query(Tenant).filter(Tenant.name == "MeterStack Demo").first()
    if not t:
        t = Tenant(name="MeterStack Demo")
        db.add(t)
        db.flush()
    u = db.query(User).filter(User.email == "demo-owner@meterstack.dev").first()
    if not u:
        u = User(tenant_id=t.id, email="demo-owner@meterstack.dev", hashed_password=hash_password(DEMO_PASSWORD), role=UserRole.owner)
        db.add(u)
        db.flush()
    else:
        u.tenant_id = t.id
        u.role = UserRole.owner
    db.add(u)
    return t, u


def _get_or_create_plans_features(db: Session) -> tuple[Plan, Plan]:
    starter = db.query(Plan).filter(Plan.name == "Starter").first()
    if not starter:
        starter = Plan(
            name="Starter",
            description="For early teams validating product-market fit with light monthly usage.",
            billing_interval=BillingInterval.monthly,
            base_price_cents=0,
        )
        db.add(starter)
        db.flush()
    pro = db.query(Plan).filter(Plan.name == "Pro").first()
    if not pro:
        pro = Plan(
            name="Pro",
            description="For growing SaaS teams that need higher volume, richer reports, and production integrations.",
            billing_interval=BillingInterval.monthly,
            base_price_cents=2900,
        )
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
    workflow_runs = _feat("workflow_runs_per_month", "Workflow Runs per Month")
    data_exports = _feat("data_exports_per_month", "Data Exports per Month")

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
    _ensure_pf(starter.id, reports.id, 30)
    _ensure_pf(starter.id, workflow_runs.id, 250)
    _ensure_pf(starter.id, data_exports.id, 15)
    _ensure_pf(pro.id, projects.id, 50)
    _ensure_pf(pro.id, api_calls.id, 100000)
    _ensure_pf(pro.id, reports.id, 500)
    _ensure_pf(pro.id, workflow_runs.id, 5000)
    _ensure_pf(pro.id, data_exports.id, 120)
    db.commit()
    return starter, pro


def _ensure_active_subscription(db: Session, tenant: Tenant, plan: Plan) -> None:
    now = datetime.now(timezone.utc)
    period_start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    period_end = period_start + timedelta(days=30)
    sub = db.query(Subscription).filter(Subscription.tenant_id == tenant.id).first()
    if sub:
        sub.plan_id = plan.id
        sub.status = SubscriptionStatus.active
        sub.current_period_start = period_start
        sub.current_period_end = period_end
        sub.cancel_at_period_end = False
        db.add(sub)
        db.commit()
        return
    new_sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        stripe_subscription_id="demo_sub",
        status=SubscriptionStatus.active,
        current_period_start=period_start,
        current_period_end=period_end,
        cancel_at_period_end=False,
    )
    db.add(new_sub)
    db.commit()


def _seed_window() -> tuple[date, date]:
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=SEEDED_DAYS - 1)
    return start_date, end_date


def _usage_seed_is_current(db: Session, tenant: Tenant, start_date, end_date) -> bool:
    range_start = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
    range_end = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)
    usage_count, first_seen, last_seen = (
        db.query(
            func.count(UsageEvent.id),
            func.min(UsageEvent.occurred_at),
            func.max(UsageEvent.occurred_at),
        )
        .filter(
            UsageEvent.tenant_id == tenant.id,
            UsageEvent.occurred_at >= range_start,
            UsageEvent.occurred_at <= range_end,
        )
        .one()
    )
    if usage_count < SEEDED_DAYS * SEEDED_EVENTS_PER_DAY:
        return False
    if not first_seen or not last_seen:
        return False
    if first_seen.date() > start_date or last_seen.date() < end_date:
        return False

    daily_row_count = (
        db.query(func.count(UsageDaily.id))
        .filter(
            UsageDaily.tenant_id == tenant.id,
            UsageDaily.date >= start_date,
            UsageDaily.date <= end_date,
        )
        .scalar()
    )
    return daily_row_count >= SEEDED_DAYS * SEEDED_FEATURE_COUNT


def _generate_usage(db: Session, tenant: Tenant) -> None:
    start_date, end_date = _seed_window()
    if _usage_seed_is_current(db, tenant, start_date, end_date):
        return

    range_start = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
    range_end = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)
    db.query(UsageEvent).filter(
        UsageEvent.tenant_id == tenant.id,
        UsageEvent.occurred_at >= range_start,
        UsageEvent.occurred_at <= range_end,
    ).delete()
    db.commit()

    def at_hour(day, hour: int, minute: int = 0) -> datetime:
        return datetime(day.year, day.month, day.day, hour, minute, tzinfo=timezone.utc)

    cur = start_date
    idx = 0
    rows_to_insert: list[UsageEvent] = []
    while cur <= end_date:
        weekday = cur.weekday()
        api_calls = max(
            1400,
            1850 + idx * 62 + [0, 120, 210, 160, 110, -260, -330][weekday] + (940 if idx in {5, 12, 18, 26} else 0) - (320 if idx in {8, 21} else 0),
        )
        reports = max(
            2,
            5 + (idx % 5) + [1, 2, 3, 2, 1, 0, 0][weekday] + (5 if idx in {9, 19, 27} else 0),
        )
        workflow_runs = max(
            26,
            48 + idx * 3 + [8, 12, 18, 14, 10, -8, -14][weekday] + (28 if idx in {6, 16, 24} else 0),
        )
        data_exports = max(
            1,
            1 + [1, 1, 2, 1, 1, 0, 0][weekday] + (4 if idx in {7, 14, 22, 28} else 0),
        )

        rows_to_insert.extend([
            UsageEvent(tenant_id=tenant.id, user_id=None, feature_key="api_calls_per_month", amount=int(api_calls * 0.42), occurred_at=at_hour(cur, 9, 15)),
            UsageEvent(tenant_id=tenant.id, user_id=None, feature_key="api_calls_per_month", amount=int(api_calls * 0.31), occurred_at=at_hour(cur, 13, 10)),
            UsageEvent(
                tenant_id=tenant.id,
                user_id=None,
                feature_key="api_calls_per_month",
                amount=api_calls - int(api_calls * 0.42) - int(api_calls * 0.31),
                occurred_at=at_hour(cur, 17, 40),
            ),
            UsageEvent(tenant_id=tenant.id, user_id=None, feature_key="workflow_runs_per_month", amount=int(workflow_runs * 0.56), occurred_at=at_hour(cur, 11, 5)),
            UsageEvent(
                tenant_id=tenant.id,
                user_id=None,
                feature_key="workflow_runs_per_month",
                amount=workflow_runs - int(workflow_runs * 0.56),
                occurred_at=at_hour(cur, 16, 25),
            ),
            UsageEvent(tenant_id=tenant.id, user_id=None, feature_key="reports_per_month", amount=reports, occurred_at=at_hour(cur, 14, 20)),
            UsageEvent(tenant_id=tenant.id, user_id=None, feature_key="data_exports_per_month", amount=data_exports, occurred_at=at_hour(cur, 18, 5)),
        ])
        cur = cur + timedelta(days=1)
        idx += 1
    db.add_all(rows_to_insert)
    db.commit()
    rebuild_daily_usage_for_range(db, start_date, end_date)


def _ensure_demo_api_keys(db: Session, tenant: Tenant) -> None:
    now = datetime.now(timezone.utc)
    keys = {
        "Production backend": (
            DEMO_API_KEY,
            True,
            now - timedelta(minutes=18),
            now - timedelta(days=134),
        ),
        "Realtime webhook worker": (
            "meterstack_demo_realtime_key_2026",
            True,
            now - timedelta(hours=6, minutes=20),
            now - timedelta(days=68),
        ),
        "Finance export job": (
            "meterstack_demo_finance_key_2026",
            True,
            now - timedelta(days=1, hours=2),
            now - timedelta(days=29),
        ),
        "Old staging worker": (
            "meterstack_demo_staging_key_2026",
            False,
            now - timedelta(days=20),
            now - timedelta(days=181),
        ),
    }
    for name, (raw_key, active, last_used_at, created_at) in keys.items():
        rec = db.query(ApiKey).filter(ApiKey.tenant_id == tenant.id, ApiKey.name == name).first()
        if not rec:
            rec = ApiKey(
                tenant_id=tenant.id,
                name=name,
                key_hash=hash_password(raw_key),
                key_prefix=raw_key[:12],
                active=active,
                created_at=created_at,
                last_used_at=last_used_at,
            )
            db.add(rec)
        else:
            rec.key_prefix = raw_key[:12]
            rec.active = active
            rec.created_at = created_at
            rec.last_used_at = last_used_at
            db.add(rec)
    db.commit()


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
        _ensure_demo_api_keys(db, t)
    finally:
        db.close()


if __name__ == "__main__":
    main()
