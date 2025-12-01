from pydantic import BaseModel
from datetime import date


class UsageSummary(BaseModel):
    feature_key: str
    total_amount: int


class UsagePoint(BaseModel):
    date: date
    total_amount: int
