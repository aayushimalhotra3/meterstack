from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from .dependencies import get_db, get_current_user, get_current_tenant
from .schemas.usage import UsageEventCreate, RebuildUsageRequest
from .models import UsageEvent, Feature, UsageDaily, Tenant
from .jobs.usage_rollup import rebuild_daily_usage_for_range
from .services.entitlements import check_entitlement_with_usage

router = APIRouter(prefix="/usage")


@router.post("/events")
def create_usage_event(body: UsageEventCreate, enforce_quota: bool = False, user=Depends(get_current_user), tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Record a usage event for the current tenant/user.

    Inputs: usage payload with `feature_key`, `amount`, optional `occurred_at`; optional `enforce_quota`.
    Returns: created event id. Assumes feature exists; optionally denies if quota would be exceeded.
    """
    feat = db.query(Feature).filter(Feature.key == body.feature_key).first()
    if not feat:
        raise HTTPException(status_code=400, detail="feature_key not found")
    if enforce_quota:
        qr = check_entitlement_with_usage(db, tenant.id, body.feature_key, body.amount or 1)
        if not qr.get("allowed"):
            raise HTTPException(status_code=422, detail={"reason": qr.get("reason"), "limit_value": qr.get("limit_value"), "current_usage": qr.get("current_usage"), "remaining": qr.get("remaining")})
    occurred = body.occurred_at or datetime.now(timezone.utc)
    ev = UsageEvent(tenant_id=tenant.id, user_id=user.id, feature_key=body.feature_key, amount=body.amount or 1, occurred_at=occurred)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return {"id": str(ev.id)}


@router.post("/admin/rebuild")
def rebuild(req: RebuildUsageRequest, db: Session = Depends(get_db)):
    """Rebuild daily usage aggregates for an inclusive date range.

    Inputs: start_date and end_date.
    Returns: summary dict of rebuild operation.
    """
    result = rebuild_daily_usage_for_range(db, req.start_date, req.end_date)
    return result


@router.get("/admin/daily")
def read_daily(date: str, tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Read daily totals for a tenant on a specific date.

    Inputs: date string, current tenant.
    Returns: list of feature totals.
    """
    rows = db.query(UsageDaily).filter(UsageDaily.date == date, UsageDaily.tenant_id == tenant.id).all()
    return [{"feature_key": r.feature_key, "total_amount": r.total_amount} for r in rows]
