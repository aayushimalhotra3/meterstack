from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class UsageEventCreate(BaseModel):
    feature_key: str = Field(min_length=1, max_length=255)
    amount: int = Field(default=1, gt=0)
    occurred_at: Optional[datetime] = None


class RebuildUsageRequest(BaseModel):
    start_date: date
    end_date: date
