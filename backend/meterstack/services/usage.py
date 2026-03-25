from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from ..models import UsageDaily, UsageEvent


def _normalize_occurred_at(occurred_at: datetime | None) -> datetime:
    dt = occurred_at or datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def record_usage_event(
    db: Session,
    *,
    tenant_id: UUID,
    feature_key: str,
    amount: int,
    user_id: UUID | None = None,
    occurred_at: datetime | None = None,
) -> UsageEvent:
    normalized_occurred_at = _normalize_occurred_at(occurred_at)
    event = UsageEvent(
        tenant_id=tenant_id,
        user_id=user_id,
        feature_key=feature_key,
        amount=amount,
        occurred_at=normalized_occurred_at,
    )
    usage_date = normalized_occurred_at.date()

    daily_row = (
        db.query(UsageDaily)
        .filter(
            UsageDaily.date == usage_date,
            UsageDaily.tenant_id == tenant_id,
            UsageDaily.feature_key == feature_key,
        )
        .first()
    )
    if daily_row:
        daily_row.total_amount += amount
        db.add(daily_row)
    else:
        db.add(
            UsageDaily(
                date=usage_date,
                tenant_id=tenant_id,
                feature_key=feature_key,
                total_amount=amount,
            )
        )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event
