import os
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite:///./test_usage.db"

from meterstack.database import SessionLocal  # noqa: E402
from meterstack.models import Base, Tenant, UsageEvent, UsageDaily  # noqa: E402
from meterstack.jobs.usage_rollup import rebuild_daily_usage_for_range  # noqa: E402
from meterstack.database import engine  # noqa: E402


def test_usage_rollup_totals():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        t = Tenant(name="UsageCo")
        db.add(t)
        db.flush()
        d1 = datetime.utcnow().date()
        d0 = d1 - timedelta(days=1)
        e1 = UsageEvent(tenant_id=t.id, user_id=None, feature_key="api_calls_per_month", amount=5, occurred_at=datetime.combine(d0, datetime.min.time()))
        e2 = UsageEvent(tenant_id=t.id, user_id=None, feature_key="api_calls_per_month", amount=7, occurred_at=datetime.combine(d0, datetime.min.time()) + timedelta(hours=1))
        e3 = UsageEvent(tenant_id=t.id, user_id=None, feature_key="projects_max", amount=2, occurred_at=datetime.combine(d1, datetime.min.time()))
        db.add_all([e1, e2, e3])
        db.commit()

        rebuild_daily_usage_for_range(db, d0, d1)
        rows = db.query(UsageDaily).filter(UsageDaily.tenant_id == t.id).all()
        totals = {(r.date, r.feature_key): r.total_amount for r in rows}
        assert totals[(d0, "api_calls_per_month")] == 12
        assert totals[(d1, "projects_max")] == 2

        rebuild_daily_usage_for_range(db, d0, d1)
        rows2 = db.query(UsageDaily).filter(UsageDaily.tenant_id == t.id).all()
        assert len(rows2) == len(rows)
    finally:
        db.close()
