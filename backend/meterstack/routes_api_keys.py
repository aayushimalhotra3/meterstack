from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import secrets
from datetime import datetime

from .dependencies import get_db, get_current_user, get_current_tenant, get_tenant_from_api_key, rate_limit
from .models import ApiKey, UserRole, Tenant, Feature
from .auth import hash_password
from .services.entitlements import check_entitlement_with_usage
from .schemas.usage import UsageEventCreate
from .schemas.entitlements import QuotaCheckRequest, QuotaCheckResponse
from .services.usage import record_usage_event

router = APIRouter(prefix="/api-keys")
client_router = APIRouter(prefix="/client")


class CreateKeyBody:
    name: str


def _ensure_owner_admin(user) -> None:
    if user.role not in (UserRole.owner, UserRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")


@router.post("")
def create_key(body: dict, user=Depends(get_current_user), tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Create a new API key for the tenant. Returns the raw key once."""
    _ensure_owner_admin(user)
    name = body.get("name")
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name required")
    raw = secrets.token_urlsafe(32)
    prefix = raw[:12]
    hashed = hash_password(raw)
    rec = ApiKey(tenant_id=tenant.id, name=name, key_hash=hashed, key_prefix=prefix, active=True)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"id": str(rec.id), "name": rec.name, "api_key": raw}


@router.get("")
def list_keys(user=Depends(get_current_user), tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """List API keys for the current tenant (owner/admin only)."""
    _ensure_owner_admin(user)
    rows = db.query(ApiKey).filter(ApiKey.tenant_id == tenant.id).order_by(ApiKey.created_at.desc()).all()
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
            "active": bool(r.active),
        }
        for r in rows
    ]


@router.post("/{key_id}/revoke")
def revoke_key(key_id: str, user=Depends(get_current_user), tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Revoke an API key by id (owner/admin only)."""
    _ensure_owner_admin(user)
    try:
        from uuid import UUID
        kid = UUID(key_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid id")
    rec = db.query(ApiKey).filter(ApiKey.id == kid, ApiKey.tenant_id == tenant.id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    rec.active = False
    db.add(rec)
    db.commit()
    return {"revoked": True}


@client_router.post("/usage/events")
def client_create_usage_event(body: UsageEventCreate, enforce_quota: bool = False, _rl=Depends(rate_limit), tenant: Tenant = Depends(get_tenant_from_api_key), db: Session = Depends(get_db)):
    """Record usage for a tenant using API key auth; optionally enforce quota before accepting."""
    feat = db.query(Feature).filter(Feature.key == body.feature_key).first()
    if not feat:
        raise HTTPException(status_code=400, detail="feature_key not found")
    if enforce_quota:
        qr = check_entitlement_with_usage(db, tenant.id, body.feature_key, body.amount or 1)
        if not qr.get("allowed"):
            raise HTTPException(status_code=422, detail={"reason": qr.get("reason"), "limit_value": qr.get("limit_value"), "current_usage": qr.get("current_usage"), "remaining": qr.get("remaining")})
    ev = record_usage_event(
        db,
        tenant_id=tenant.id,
        user_id=None,
        feature_key=body.feature_key,
        amount=body.amount or 1,
        occurred_at=body.occurred_at,
    )
    return {"id": str(ev.id)}


@client_router.post("/entitlements/check-quota", response_model=QuotaCheckResponse)
def client_check_quota(body: QuotaCheckRequest, _rl=Depends(rate_limit), tenant: Tenant = Depends(get_tenant_from_api_key), db: Session = Depends(get_db)):
    """Quota-aware entitlement check for API-key clients; returns remaining quota and usage."""
    result = check_entitlement_with_usage(db, tenant.id, body.feature_key, body.amount)
    return QuotaCheckResponse(
        feature_key=result["feature_key"],
        allowed=result["allowed"],
        reason=result["reason"],
        limit_value=result["limit_value"],
        current_usage=result["current_usage"],
        remaining=result["remaining"],
    )
