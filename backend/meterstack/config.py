import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/meterstack")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
SYSTEM_ADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "")
BILLING_MODE = os.getenv("BILLING_MODE", "stripe")
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "120"))
