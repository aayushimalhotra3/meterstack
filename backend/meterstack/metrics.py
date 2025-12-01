import time
from typing import Dict, Tuple

_counters: Dict[Tuple[str, str], int] = {}
_latencies: Dict[Tuple[str, str], list] = {}


def record(path: str, method: str, duration_ms: float):
    k = (path, method)
    _counters[k] = _counters.get(k, 0) + 1
    arr = _latencies.get(k)
    if arr is None:
        arr = []
        _latencies[k] = arr
    arr.append(duration_ms)


def snapshot():
    out = []
    for (path, method), count in _counters.items():
        arr = _latencies.get((path, method), [])
        buckets = {"lt100": 0, "lt500": 0, "gte500": 0}
        for v in arr:
            if v < 100:
                buckets["lt100"] += 1
            elif v < 500:
                buckets["lt500"] += 1
            else:
                buckets["gte500"] += 1
        out.append({"path": path, "method": method, "count": count, "latency_buckets": buckets})
    return out
