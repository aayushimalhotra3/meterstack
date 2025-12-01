import uuid
from datetime import date
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import UsageDaily, Subscription, SubscriptionStatus, Plan


def get_tenant_usage_summary(db: Session, tenant_id: uuid.UUID, period_start: date, period_end: date) -> List[dict]:
    """Compute aggregated usage totals per feature for a tenant within a billing period.

    Inputs: SQLAlchemy session, tenant id, start and end dates.
    Output: list of dicts with `feature_key` and `total_amount`.
    Assumes: usage has been rolled up into `UsageDaily` records.
    """
    rows = (
        db.query(UsageDaily.feature_key, func.sum(UsageDaily.total_amount))
        .filter(UsageDaily.tenant_id == tenant_id, UsageDaily.date >= period_start, UsageDaily.date <= period_end)
        .group_by(UsageDaily.feature_key)
        .all()
    )
    return [{"feature_key": fk, "total_amount": int(total or 0)} for fk, total in rows]


def get_tenant_usage_timeseries(db: Session, tenant_id: uuid.UUID, feature_key: str, period_start: date, period_end: date) -> List[dict]:
    """Return daily usage timeseries for a single feature within the period.

    Inputs: session, tenant id, feature_key, start and end dates.
    Output: list of dicts with `date` and `total_amount` ordered ascending by date.
    Assumes: feature_key exists; returns empty list if no data.
    """
    rows = (
        db.query(UsageDaily.date, UsageDaily.total_amount)
        .filter(
            UsageDaily.tenant_id == tenant_id,
            UsageDaily.feature_key == feature_key,
            UsageDaily.date >= period_start,
            UsageDaily.date <= period_end,
        )
        .order_by(UsageDaily.date.asc())
        .all()
    )
    return [{"date": d, "total_amount": int(total or 0)} for d, total in rows]


def get_current_billing_period(db: Session, tenant_id: uuid.UUID) -> Optional[Tuple[date, date]]:
    """Resolve the current active/trialing subscription period for a tenant.

    Inputs: session and tenant id.
    Output: (period_start_date, period_end_date) or None if no active subscription.
    """
    sub = (
        db.query(Subscription)
        .filter(Subscription.tenant_id == tenant_id, Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trialing]))
        .order_by(Subscription.current_period_start.desc())
        .first()
    )
    if not sub:
        return None
    return (sub.current_period_start.date(), sub.current_period_end.date())
