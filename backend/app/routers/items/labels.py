from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.services.items.labels import enrich_labels

router = APIRouter(prefix="/api/items/labels", tags=["Items - Etichette"])

_PERM_VIEW = require_permission("stampa_etichette")


class LabelEnrichRequest(BaseModel):
    zebra_codes: list[str]
    mode: str = "normal"  # normal | promo | bf | advance | special


@router.post("/enrich", dependencies=[Depends(_PERM_VIEW)])
async def enrich(payload: LabelEnrichRequest, db: AsyncSession = Depends(get_db)):
    results = await enrich_labels(db, payload.zebra_codes, payload.mode)
    return {"items": results, "mode": payload.mode}
