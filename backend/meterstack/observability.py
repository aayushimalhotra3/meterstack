import logging
import json
from datetime import datetime, timezone


def configure():
    logging.basicConfig(level=logging.INFO)


def log_json(event: dict):
    msg = {"ts": datetime.now(timezone.utc).isoformat(), **event}
    logging.info(json.dumps(msg))
