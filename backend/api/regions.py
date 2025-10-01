from fastapi import APIRouter
from backend.crud import get_regions

router = APIRouter(prefix="/api", tags=["regions"])

@router.get("/regions")
def regions():
    return get_regions()
