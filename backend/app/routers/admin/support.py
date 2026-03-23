from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.auth import User, UserDepartment
from app.models.support import SupportErrorCode
from app.core.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/api/admin/support", tags=["Admin - Support"])


@router.get(
    "/lookup/{code}",
    dependencies=[Depends(require_permission("system.admin"))],
)
async def lookup_error_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.department != UserDepartment.SUPERUSER:
        raise HTTPException(status_code=403, detail="Accesso riservato al Supporto")

    result = await db.execute(
        select(SupportErrorCode).where(
            SupportErrorCode.code == code.upper(),
            SupportErrorCode.is_active == True,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Codice non trovato")

    return {
        "code": entry.code,
        "module": entry.module,
        "description": entry.description,
        "prompt": entry.prompt,
    }


@router.get(
    "/codes",
    dependencies=[Depends(require_permission("system.admin"))],
)
async def list_codes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.department != UserDepartment.SUPERUSER:
        raise HTTPException(status_code=403, detail="Accesso riservato al Supporto")

    result = await db.execute(
        select(SupportErrorCode)
        .where(SupportErrorCode.is_active == True)
        .order_by(SupportErrorCode.code)
    )
    entries = result.scalars().all()
    return [
        {"code": e.code, "module": e.module, "description": e.description}
        for e in entries
    ]
