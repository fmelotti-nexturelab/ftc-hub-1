from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_permission
from app.database import get_db
from app.models.auth import User
from app.models.ho import CheckPrezziLista
from app.schemas.check_prezzi import (
    CheckPrezziListaItem,
    CheckPrezziListaMeta,
    CheckPrezziListaReplace,
    CheckPrezziListaResponse,
)

router = APIRouter(prefix="/api/utilities/check-prezzi", tags=["Utilities - Check Prezzi"])

VALID_ENTITIES = {"IT01", "IT02", "IT03"}


def _validate_entity(entity: str) -> str:
    entity = entity.upper()
    if entity not in VALID_ENTITIES:
        raise HTTPException(status_code=400, detail=f"Entity '{entity}' non valida")
    return entity


@router.get(
    "/lista/{entity}",
    response_model=CheckPrezziListaResponse,
    dependencies=[Depends(require_permission("check_prezzi"))],
)
async def get_lista(
    entity: str = Path(..., description="IT01 | IT02 | IT03"),
    db: AsyncSession = Depends(get_db),
):
    """Restituisce la lista cambi prezzi corrente per la entity + metadata caricamento."""
    entity = _validate_entity(entity)

    result = await db.execute(
        select(CheckPrezziLista)
        .where(CheckPrezziLista.entity == entity)
        .order_by(CheckPrezziLista.item_number)
    )
    rows = result.scalars().all()

    items = [CheckPrezziListaItem.model_validate(r) for r in rows]

    meta = CheckPrezziListaMeta()
    if rows:
        first = rows[0]
        meta.source_filename = first.source_filename
        meta.uploaded_at = first.uploaded_at
        meta.uploaded_by = first.uploaded_by
        if first.uploaded_by:
            user_res = await db.execute(
                select(User.username).where(User.id == first.uploaded_by)
            )
            username = user_res.scalar_one_or_none()
            meta.uploaded_by_name = username

    return CheckPrezziListaResponse(entity=entity, items=items, meta=meta)


@router.put(
    "/lista/{entity}",
    response_model=CheckPrezziListaResponse,
    dependencies=[Depends(require_permission("check_prezzi", need_manage=True))],
)
async def replace_lista(
    data: CheckPrezziListaReplace,
    entity: str = Path(..., description="IT01 | IT02 | IT03"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sostituisce completamente la lista cambi prezzi per la entity.
    Delete + insert atomici: non si tiene storico.
    """
    entity = _validate_entity(entity)

    # Delete + insert dentro la stessa transazione (commit alla fine)
    await db.execute(
        delete(CheckPrezziLista).where(CheckPrezziLista.entity == entity)
    )

    new_rows: List[CheckPrezziLista] = []
    for item in data.items:
        new_rows.append(
            CheckPrezziLista(
                entity=entity,
                item_number=item.item_number,
                new_price=item.new_price,
                old_price=item.old_price,
                reason=item.reason,
                status=item.status,
                source_filename=data.source_filename,
                uploaded_by=current_user.id,
            )
        )
    db.add_all(new_rows)
    await db.commit()

    # Rileggi per tornare la response canonica con meta popolata
    return await get_lista(entity=entity, db=db)
