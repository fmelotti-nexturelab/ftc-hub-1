import logging

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.services.items.it02 import VALID_ENTITIES, generate_itemlist

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/items", tags=["Items - IT02/IT03"])

_PERM_MANAGE = require_permission("items_view", need_manage=True)


class GenerateRequest(BaseModel):
    rows: list[list[str]]


@router.post("/{entity}/generate", dependencies=[Depends(_PERM_MANAGE)])
async def generate(
    body: GenerateRequest,
    entity: str = Path(..., regex="^IT0[23]$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Genera ItemList da dati TSV per IT02 o IT03.
    Salva il file archivio nello storage e ritorna i bytes per il legacy save.
    """
    entity = entity.upper()
    if entity not in VALID_ENTITIES:
        raise HTTPException(status_code=400, detail=f"Entity non supportata: {entity}")

    if not body.rows or len(body.rows) < 2:
        raise HTTPException(status_code=422, detail="Dati insufficienti")

    try:
        result = await generate_itemlist(entity=entity, rows=body.rows, db=db)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return Response(
        content=result["xlsx_bytes"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{result["legacy_filename"]}"',
            "X-Row-Count": str(result["row_count"]),
            "X-Legacy-Filename": result["legacy_filename"],
        },
    )
