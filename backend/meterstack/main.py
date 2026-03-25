from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import engine
from .models import Base, Tenant, User, UserRole
from .dependencies import get_db, get_current_user, get_current_tenant
from .auth import hash_password, verify_password, create_access_token
from .config import ALLOWED_ORIGINS
from .routes_billing import router as billing_router
from .routes_entitlements import router as entitlements_router
from .routes_usage import router as usage_router
from .routes_analytics import router as analytics_router
from .routes_metrics import router as metrics_router
from .routes_api_keys import router as api_keys_router, client_router as client_router
from .metrics import record
from .observability import configure, log_json
from contextlib import asynccontextmanager
import time

@asynccontextmanager
async def _lifespan(app: FastAPI):
    configure()
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass
    log_json({"level": "info", "message": "startup_complete"})
    yield

app = FastAPI(lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(billing_router)
app.include_router(entitlements_router)
app.include_router(usage_router)
app.include_router(analytics_router)
app.include_router(metrics_router)
app.include_router(api_keys_router)
app.include_router(client_router)


@app.middleware("http")
async def _metrics_mw(request: Request, call_next):
    start = time.time()
    resp = await call_next(request)
    dur = (time.time() - start) * 1000.0
    record(request.url.path, request.method, dur)
    return resp

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/debug/schema")
def debug_schema():
    return {"tables": sorted(list(Base.metadata.tables.keys()))}


class SignupRequest(BaseModel):
    tenant_name: str
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/signup", response_model=TokenResponse)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == body.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    tenant = Tenant(name=body.tenant_name)
    db.add(tenant)
    db.flush()  # get tenant.id

    user = User(
        tenant_id=tenant.id,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.owner,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"user_id": str(user.id), "tenant_id": str(tenant.id)})
    return TokenResponse(access_token=token)


@app.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"user_id": str(user.id), "tenant_id": str(user.tenant_id)})
    return TokenResponse(access_token=token)


@app.get("/me")
def me(user: User = Depends(get_current_user), tenant: Tenant = Depends(get_current_tenant)):
    return {
        "user": {"id": str(user.id), "email": user.email, "role": user.role.value},
        "tenant": {"id": str(tenant.id), "name": tenant.name},
    }
