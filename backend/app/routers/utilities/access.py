from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user, _user_can_access_module
from app.models.auth import User, UserType

router = APIRouter(prefix="/api/utilities", tags=["Utilities"])

UTILITY_MODULES = ["utilities_stores"]


@router.get("/my-access")
async def my_access(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restituisce i permessi effettivi dell'utente corrente per i moduli utility."""
    user_type = getattr(current_user, "user_type", None)
    is_admin = user_type in (UserType.SUPERUSER, UserType.ADMIN)

    result = {}
    for module_code in UTILITY_MODULES:
        if is_admin:
            result[module_code] = {"can_view": True, "can_manage": True}
        else:
            can_view = await _user_can_access_module(db, current_user, module_code, need_manage=False)
            can_manage = await _user_can_access_module(db, current_user, module_code, need_manage=True)
            result[module_code] = {"can_view": can_view, "can_manage": can_manage}

    return result
