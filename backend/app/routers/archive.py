import logging
from datetime import date
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.database import get_db
from app.models.auth import User
from app.models.file_archive import FileArchive
from app.services.app_settings_service import get_storage_path

logger = logging.getLogger(__name__)

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
        .where(func.lower(FileArchive.file_type) == file_type.lower(), func.lower(FileArchive.entity) == entity.lower())
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
            func.lower(FileArchive.file_type) == file_type.lower(),
            func.lower(FileArchive.entity) == entity.lower(),
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


@router.post("/save-file", dependencies=[Depends(_PERM)])
async def save_file_to_storage(
    file: UploadFile = File(...),
    relative_path: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Salva un file nella cartella FTC HUB Storage al percorso relativo indicato.
    Il percorso assoluto viene costruito come: FILE_STORAGE_PATH / relative_path.
    """
    try:
        storage_root = get_storage_path()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Sicurezza: impedisci path traversal
    safe_path = Path(relative_path)
    if ".." in safe_path.parts:
        raise HTTPException(status_code=400, detail="Percorso non valido")

    dest = Path(storage_root) / safe_path
    dest.parent.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    dest.write_bytes(content)
    logger.info("Salvato file: %s (%d bytes)", dest, len(content))

    return {"path": str(dest), "size": len(content)}
