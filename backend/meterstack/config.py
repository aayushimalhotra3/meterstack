import os
from dotenv import load_dotenv

load_dotenv()


def _parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./meterstack_dev.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
SYSTEM_ADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "")
BILLING_MODE = os.getenv("BILLING_MODE", "stripe")
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "120"))
BCRYPT_ROUNDS = _parse_int("BCRYPT_ROUNDS", 12)
ALLOWED_ORIGINS = _parse_csv(os.getenv("ALLOWED_ORIGINS")) or [
    FRONTEND_BASE_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
ENABLE_DEV_ENDPOINTS = _parse_bool("ENABLE_DEV_ENDPOINTS", default=False)


def get_billing_mode() -> str:
    return os.getenv("BILLING_MODE", BILLING_MODE)
