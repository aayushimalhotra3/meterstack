from typing import Generator
from fastapi import Depends, Header, HTTPException, status, Request
from sqlalchemy.orm import Session

import uuid
from datetime import datetime, timezone
from .database import SessionLocal
from .auth import decode_access_token, verify_password
from .models import User, Tenant, ApiKey
from .config import RATE_LIMIT_PER_MIN, ENABLE_DEV_ENDPOINTS
import time


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("user_id")
    tenant_id = payload.get("tenant_id")
    if not user_id or not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user id")
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_tenant(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tenant not found")
    return tenant


def get_tenant_from_api_key(x_api_key: str | None = Header(default=None, alias="X-Api-Key"), db: Session = Depends(get_db)) -> Tenant:
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_api_key")
    prefix = x_api_key[:12]
    rec = db.query(ApiKey).filter(ApiKey.key_prefix == prefix, ApiKey.active.is_(True)).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_api_key")
    if not verify_password(x_api_key, rec.key_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_api_key")
    tenant = db.query(Tenant).filter(Tenant.id == rec.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_not_found")
    rec.last_used_at = datetime.now(timezone.utc)
    db.add(rec)
    db.commit()
    return tenant


_rl_store: dict[str, list[float]] = {}


def rate_limit(request: Request, x_api_key: str | None = Header(default=None, alias="X-Api-Key")) -> None:
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_api_key")
    key = f"{x_api_key}:{request.url.path}"
    now = time.time()
    window_start = now - 60.0
    buf = _rl_store.get(key, [])
    buf = [t for t in buf if t >= window_start]
    if len(buf) >= RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limit_exceeded")
    buf.append(now)
    _rl_store[key] = buf


def ensure_dev_endpoints_enabled() -> None:
    if not ENABLE_DEV_ENDPOINTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
