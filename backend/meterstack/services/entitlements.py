import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, date

from ..models import Subscription, SubscriptionStatus, Plan, PlanFeature, Feature, UsageDaily
from .analytics import get_current_billing_period


def _active_subscription_for_tenant(db: Session, tenant_id: uuid.UUID) -> Subscription | None:
    """Return latest active/trialing subscription for a tenant or None."""
    return (
        db.query(Subscription)
        .filter(Subscription.tenant_id == tenant_id, Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trialing]))
        .order_by(Subscription.current_period_start.desc())
        .first()
    )


def get_tenant_entitlements(db: Session, tenant_id: uuid.UUID) -> List[dict]:
    """List entitlements for a tenant based on current subscription plan.

    Output entries include feature key, display name, limit value, and inclusion flag.
    Returns empty list when no active subscription or plan mapping.
    """
    sub = _active_subscription_for_tenant(db, tenant_id)
    if not sub:
        return []
    plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
    if not plan:
        return []
    pfs = (
        db.query(PlanFeature, Feature)
        .join(Feature, PlanFeature.feature_id == Feature.id)
        .filter(PlanFeature.plan_id == plan.id)
        .all()
    )
    entitlements: List[dict] = []
    for pf, feat in pfs:
        entitlements.append(
            {
                "feature_key": feat.key,
                "feature_name": feat.name,
                "limit_value": pf.limit_value,
                "included": True,
            }
        )
    return entitlements


def check_entitlement(db: Session, tenant_id: uuid.UUID, feature_key: str) -> dict:
    """Check whether a feature is allowed by the tenant's current plan.

    Returns dict with `feature_key`, `allowed`, `limit_value`, and `reason` when disallowed.
    Requires an active/trialing subscription to permit features.
    """
    sub = _active_subscription_for_tenant(db, tenant_id)
    if not sub:
        return {"feature_key": feature_key, "allowed": False, "limit_value": None, "reason": "no_active_subscription"}
    plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
    if not plan:
        return {"feature_key": feature_key, "allowed": False, "limit_value": None, "reason": "no_active_subscription"}
    pf = (
        db.query(PlanFeature, Feature)
        .join(Feature, PlanFeature.feature_id == Feature.id)
        .filter(PlanFeature.plan_id == plan.id, Feature.key == feature_key)
        .first()
    )
    if not pf:
        return {"feature_key": feature_key, "allowed": False, "limit_value": None, "reason": "feature_not_in_plan"}
    plan_feature, feature = pf
    return {"feature_key": feature.key, "allowed": True, "limit_value": plan_feature.limit_value, "reason": None}


def _sum_usage_in_period(db: Session, tenant_id: uuid.UUID, feature_key: str, start_date: date, end_date: date) -> int:
    rows = (
        db.query(UsageDaily.total_amount)
        .filter(UsageDaily.tenant_id == tenant_id, UsageDaily.feature_key == feature_key, UsageDaily.date >= start_date, UsageDaily.date <= end_date)
        .all()
    )
    return sum(int(r[0] or 0) for r in rows)


def check_entitlement_with_usage(db: Session, tenant_id: uuid.UUID, feature_key: str, amount: int = 1, now: Optional[datetime] = None) -> dict:
    """Quota-aware entitlement check that projects usage with the requested amount.

    Computes current period, sums `UsageDaily` for the feature, and compares against plan limit.
    Returns `allowed`, `reason`, `limit_value`, `current_usage`, and `remaining` fields.
    Disallows when no active subscription or feature is not in plan.
    """
    base = check_entitlement(db, tenant_id, feature_key)
    if not base.get("allowed"):
        return {"feature_key": feature_key, "allowed": False, "reason": base.get("reason"), "limit_value": None, "current_usage": None, "remaining": None}
    limit_value = base.get("limit_value")
    if limit_value is None:
        return {"feature_key": feature_key, "allowed": True, "reason": None, "limit_value": None, "current_usage": None, "remaining": None}
    period = get_current_billing_period(db, tenant_id)
    if not period:
        return {"feature_key": feature_key, "allowed": False, "reason": "no_active_subscription", "limit_value": None, "current_usage": None, "remaining": None}
    start_date, end_date = period
    current_usage = _sum_usage_in_period(db, tenant_id, feature_key, start_date, end_date)
    projected = current_usage + (amount or 1)
    if projected <= int(limit_value):
        remaining = int(limit_value) - projected
        return {"feature_key": feature_key, "allowed": True, "reason": None, "limit_value": int(limit_value), "current_usage": current_usage, "remaining": remaining}
    return {
        "feature_key": feature_key,
        "allowed": False,
        "reason": "quota_exceeded",
        "limit_value": int(limit_value),
        "current_usage": current_usage,
        "remaining": 0,
    }
