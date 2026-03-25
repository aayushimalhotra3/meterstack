from pathlib import Path
import os
import sys


ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_suite.db")
os.environ.setdefault("ENABLE_DEV_ENDPOINTS", "true")
os.environ.setdefault("BILLING_MODE", "mock")
