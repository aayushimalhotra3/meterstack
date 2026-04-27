from conftest import reset_test_db

from meterstack.database import SessionLocal
from meterstack.demo_seed import _seed_window, _usage_seed_is_current, main as run_demo_seed
from meterstack.models import Tenant, UsageEvent


def _reset_db() -> None:
    reset_test_db()


def test_demo_seed_marks_current_window_as_seeded():
    _reset_db()
    run_demo_seed()

    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.name == "MeterStack Demo").one()
        start_date, end_date = _seed_window()
        assert _usage_seed_is_current(db, tenant, start_date, end_date) is True
    finally:
        db.close()


def test_demo_seed_second_run_does_not_duplicate_usage_events():
    _reset_db()
    run_demo_seed()

    db = SessionLocal()
    try:
        first_count = db.query(UsageEvent).count()
    finally:
        db.close()

    run_demo_seed()

    db = SessionLocal()
    try:
        second_count = db.query(UsageEvent).count()
        assert second_count == first_count
    finally:
        db.close()
