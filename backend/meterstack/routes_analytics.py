from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from .dependencies import get_db, get_current_user, get_current_tenant
from .models import UserRole, Feature, Tenant, Subscription, Plan, SubscriptionStatus
from .schemas.analytics import UsageSummary, UsagePoint
from .services.analytics import get_tenant_usage_summary, get_tenant_usage_timeseries, get_current_billing_period
from .config import os as _os

router = APIRouter(prefix="/analytics")


def _ensure_owner_admin(user) -> None:
    if user.role not in (UserRole.owner, UserRole.admin):
        raise HTTPException(status_code=403, detail="forbidden")


@router.get("/summary")
def summary(start_date: Optional[date] = None, end_date: Optional[date] = None, user=Depends(get_current_user), tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Return aggregated usage summary for a tenant within a period.

    Inputs: optional start/end dates; resolves current period if omitted.
    Output: period boundaries and per-feature totals; requires owner/admin.
    """
    _ensure_owner_admin(user)
    if not start_date or not end_date:
        period = get_current_billing_period(db, tenant.id)
        if not period:
            raise HTTPException(status_code=400, detail="no_active_subscription")
        start_date, end_date = period
    data = get_tenant_usage_summary(db, tenant.id, start_date, end_date)
    return {"period_start": start_date.isoformat(), "period_end": end_date.isoformat(), "usage": [UsageSummary(**d).dict() for d in data]}


@router.get("/timeseries")
def timeseries(feature_key: str, start_date: Optional[date] = None, end_date: Optional[date] = None, user=Depends(get_current_user), tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Return daily usage timeseries for a feature within a period.

    Inputs: feature_key and optional period; resolves current period if omitted.
    Output: list of date/amount points; requires owner/admin.
    """
    _ensure_owner_admin(user)
    if not db.query(Feature).filter(Feature.key == feature_key).first():
        raise HTTPException(status_code=400, detail="feature_key not found")
    if not start_date or not end_date:
        period = get_current_billing_period(db, tenant.id)
        if not period:
            raise HTTPException(status_code=400, detail="no_active_subscription")
        start_date, end_date = period
    points = get_tenant_usage_timeseries(db, tenant.id, feature_key, start_date, end_date)
    return {
        "feature_key": feature_key,
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "points": [UsagePoint(**p).dict() for p in points],
    }


@router.get("/admin/tenants")
def admin_tenants(user=Depends(get_current_user), db: Session = Depends(get_db)):
    admin_email = _os.getenv("SYSTEM_ADMIN_EMAIL", "")
    if not admin_email or user.email != admin_email:
        raise HTTPException(status_code=403, detail="forbidden")
    subs = (
        db.query(Tenant, Subscription, Plan)
        .join(Subscription, Subscription.tenant_id == Tenant.id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .filter(Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trialing]))
        .all()
    )
    out = []
    for tenant, sub, plan in subs:
        out.append(
            {
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "current_plan_name": plan.name,
                "subscription_status": sub.status.value,
                "estimated_mrr_cents": plan.base_price_cents,
            }
        )
    return out
