from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import uuid

from .dependencies import get_db, get_current_tenant, ensure_dev_endpoints_enabled
from .services.entitlements import get_tenant_entitlements, check_entitlement, check_entitlement_with_usage
from .schemas.entitlements import Entitlement, EntitlementCheckRequest, EntitlementCheckResponse, QuotaCheckRequest, QuotaCheckResponse
from .models import Feature, Plan, PlanFeature, BillingInterval

router = APIRouter(prefix="/entitlements")


@router.get("/", response_model=list[Entitlement])
def list_entitlements(tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    """List entitlements for the current tenant based on active subscription plan."""
    ents = get_tenant_entitlements(db, tenant.id)
    return [
        Entitlement(feature_key=e["feature_key"], name=e["feature_name"], limit_value=e["limit_value"], included=e["included"]) for e in ents
    ]


@router.post("/check", response_model=EntitlementCheckResponse)
def check(body: EntitlementCheckRequest, tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Check whether a feature is included and optionally limited by the tenant's plan."""
    result = check_entitlement(db, tenant.id, body.feature_key)
    return EntitlementCheckResponse(
        feature_key=result["feature_key"], allowed=result["allowed"], limit_value=result["limit_value"], reason=result["reason"]
    )


@router.post("/check-quota", response_model=QuotaCheckResponse)
def check_quota(body: QuotaCheckRequest, tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    """Quota-aware entitlement check projecting requested amount against current period usage totals."""
    result = check_entitlement_with_usage(db, tenant.id, body.feature_key, body.amount)
    return QuotaCheckResponse(
        feature_key=result["feature_key"],
        allowed=result["allowed"],
        reason=result["reason"],
        limit_value=result["limit_value"],
        current_usage=result["current_usage"],
        remaining=result["remaining"],
    )


@router.post("/admin/seed")
def seed(db: Session = Depends(get_db)):
    """Seed demo plans and features with reasonable limits for local/dev setups."""
    ensure_dev_endpoints_enabled()
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

    def get_feat(key: str, name: str):
        f = db.query(Feature).filter(Feature.key == key).first()
        if not f:
            f = Feature(key=key, name=name)
            db.add(f)
            db.flush()
        return f

    projects = get_feat("projects_max", "Projects Max")
    api_calls = get_feat("api_calls_per_month", "API Calls per Month")
    reports = get_feat("reports_per_month", "Reports per Month")

    def ensure_pf(plan_id: uuid.UUID, feature_id: uuid.UUID, limit_value: int | None):
        pf = db.query(PlanFeature).filter(PlanFeature.plan_id == plan_id, PlanFeature.feature_id == feature_id).first()
        if not pf:
            pf = PlanFeature(plan_id=plan_id, feature_id=feature_id, limit_value=limit_value)
            db.add(pf)
        else:
            pf.limit_value = limit_value
            db.add(pf)

    ensure_pf(starter.id, projects.id, 5)
    ensure_pf(starter.id, api_calls.id, 10000)
    ensure_pf(starter.id, reports.id, 20)
    ensure_pf(pro.id, projects.id, 50)
    ensure_pf(pro.id, api_calls.id, 100000)
    ensure_pf(pro.id, reports.id, None)

    db.commit()
    return {"seeded": True}
