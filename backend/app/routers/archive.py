from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.database import get_db
from app.models.auth import User
from app.models.file_archive import FileArchive

router = APIRouter(prefix="/api/archive", tags=["Archive"])

_PERM = require_permission("utilities_stock_nav")


@router.get("/dates", dependencies=[Depends(_PERM)])
async def get_archive_dates(
    file_type: str,
    entity: str,
    db: AsyncSession = Depends(get_db),
):
    """Restituisce le date per cui esiste un file in archivio per tipo+entity."""
    result = await db.execute(
        select(FileArchive.file_date)
        .where(FileArchive.file_type == file_type, FileArchive.entity == entity)
        .order_by(FileArchive.file_date.asc())
    )
    dates = result.scalars().all()
    return {"dates": [d.isoformat() for d in dates]}


@router.post("/register", dependencies=[Depends(_PERM)])
async def register_archive(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra o aggiorna un file in archivio (upsert su file_type+entity+file_date)."""
    file_type = payload.get("file_type")
    entity = payload.get("entity")
    file_date_str = payload.get("file_date")
    file_path = payload.get("file_path")

    if not all([file_type, entity, file_date_str]):
        raise HTTPException(status_code=400, detail="file_type, entity e file_date sono obbligatori")

    try:
        file_date = date.fromisoformat(file_date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="file_date non valida. Formato atteso: YYYY-MM-DD")

    result = await db.execute(
        select(FileArchive).where(
            FileArchive.file_type == file_type,
            FileArchive.entity == entity,
            FileArchive.file_date == file_date,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.file_path = file_path
        existing.created_by = current_user.id
    else:
        db.add(FileArchive(
            file_type=file_type,
            entity=entity,
            file_date=file_date,
            file_path=file_path,
            created_by=current_user.id,
        ))

    await db.commit()
    return {"message": "Registrato"}
