from datetime import date, datetime, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session

from ..models import UsageEvent, UsageDaily
from ..observability import log_json


def rebuild_daily_usage_for_range(db: Session, start_date: date, end_date: date) -> dict:
    """Aggregate `UsageEvent` into `UsageDaily` totals for each day in [start_date, end_date].

    Inputs: session, start and end dates (inclusive).
    For each day, sums `amount` per (tenant_id, feature_key) and upserts into `UsageDaily`.
    """
    cur = start_date
    updated = 0
    while cur <= end_date:
        start_dt = datetime.combine(cur, datetime.min.time())
        end_dt = datetime.combine(cur, datetime.max.time())
        events = (
            db.query(UsageEvent)
            .filter(UsageEvent.occurred_at >= start_dt, UsageEvent.occurred_at <= end_dt)
            .all()
        )
        totals = defaultdict(int)
        for e in events:
            key = (e.tenant_id, e.feature_key)
            totals[key] += e.amount
        existing_rows = db.query(UsageDaily).filter(UsageDaily.date == cur).all()
        existing_map = {(row.tenant_id, row.feature_key): row for row in existing_rows}
        for (tenant_id, feature_key), total in totals.items():
            row = existing_map.pop((tenant_id, feature_key), None)
            if row:
                row.total_amount = total
                db.add(row)
            else:
                db.add(UsageDaily(date=cur, tenant_id=tenant_id, feature_key=feature_key, total_amount=total))
            updated += 1
        for stale_row in existing_map.values():
            db.delete(stale_row)
        db.commit()
        log_json({"level": "info", "message": "usage_daily_commit", "date": cur.isoformat(), "updated": updated})
        cur = cur + timedelta(days=1)
    return {"updated": updated}
