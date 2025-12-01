from fastapi import APIRouter
from .metrics import snapshot

router = APIRouter()


@router.get("/metrics")
def metrics():
    return {"routes": snapshot()}
