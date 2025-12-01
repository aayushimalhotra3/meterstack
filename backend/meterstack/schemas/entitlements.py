from pydantic import BaseModel, Field
from typing import Optional


class Entitlement(BaseModel):
    feature_key: str
    name: str
    limit_value: Optional[int] = None
    included: bool


class EntitlementCheckRequest(BaseModel):
    feature_key: str = Field(min_length=1, max_length=255)


class EntitlementCheckResponse(BaseModel):
    feature_key: str
    allowed: bool
    limit_value: Optional[int] = None
    reason: Optional[str] = None


class QuotaCheckRequest(BaseModel):
    feature_key: str = Field(min_length=1, max_length=255)
    amount: int = Field(default=1, gt=0)


class QuotaCheckResponse(BaseModel):
    feature_key: str
    allowed: bool
    reason: Optional[str] = None
    limit_value: Optional[int] = None
    current_usage: Optional[int] = None
    remaining: Optional[int] = None
