from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.operator_code import OperatorCode
from app.schemas.operator_code import OperatorCodeResponse
from app.core.dependencies import require_permission

router = APIRouter(prefix="/api/ho/operator-codes", tags=["HO - Codice Operatore"])

_PERM_VIEW = require_permission("codici_operatore")


@router.get(
    "",
    response_model=List[OperatorCodeResponse],
    dependencies=[Depends(_PERM_VIEW)],
)
async def list_operator_codes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OperatorCode).where(OperatorCode.is_active == True).order_by(OperatorCode.created_at.desc())
    )
    return result.scalars().all()
