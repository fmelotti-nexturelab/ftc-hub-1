from fastapi import APIRouter, Depends
from app.core.dependencies import require_permission

router = APIRouter(
    prefix="/api/test-rbac",
    tags=["Test RBAC"],
)

@router.get(
    "/admin-only",
    dependencies=[Depends(require_permission("system.admin"))],
)
async def admin_only():
    return {"message": "Accesso admin consentito"}