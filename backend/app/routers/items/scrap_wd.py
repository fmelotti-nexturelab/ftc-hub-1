from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.models.items import ScrapWd

router = APIRouter(prefix="/api/items/scrap-wd", tags=["Items - Scrap Wd"])

_PERM_VIEW = require_permission("items_view")
_PERM_MANAGE = require_permission("items_view", need_manage=True)


def _ser(i):
    return {
        "id": i.id, "zebra": i.zebra,
        "bloccato": i.bloccato, "descrizione": i.descrizione,
        "categoria": i.categoria,
    }


def _clean(raw: dict) -> dict:
    out = {}
    allowed = {"zebra", "bloccato", "descrizione", "categoria"}
    for k, v in raw.items():
        if k not in allowed:
            continue
        if v is None or v == "":
            out[k] = None if k != "zebra" else ""
        else:
            out[k] = str(v).strip()
    return out


# ── Schemas ──────────────────────────────────────────────────────────────────

class ReplaceRequest(BaseModel):
    rows: list[dict]

class AppendRowsRequest(BaseModel):
    rows: list[dict]

class DeleteIdsRequest(BaseModel):
    ids: list[int]


# ── GET all ──────────────────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(_PERM_VIEW)])
async def get_all(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScrapWd).order_by(ScrapWd.zebra))
    return {"rows": [_ser(i) for i in result.scalars().all()]}


# ── PUT replace all ─────────────────────────────────────────────────────────

@router.put("", dependencies=[Depends(_PERM_MANAGE)])
async def replace_all(payload: ReplaceRequest, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ScrapWd))
    cleaned = [r for r in [_clean(r) for r in payload.rows] if r.get("zebra")]
    if cleaned:
        await db.execute(ScrapWd.__table__.insert(), cleaned)
    await db.commit()
    return {"count": len(cleaned)}


# ── POST append ──────────────────────────────────────────────────────────────

@router.post("", dependencies=[Depends(_PERM_MANAGE)])
async def append_rows(payload: AppendRowsRequest, db: AsyncSession = Depends(get_db)):
    cleaned = [r for r in [_clean(r) for r in payload.rows] if r.get("zebra")]
    if cleaned:
        await db.execute(ScrapWd.__table__.insert(), cleaned)
    await db.commit()
    return {"count": len(cleaned)}


# ── PATCH single row ────────────────────────────────────────────────────────

@router.patch("/{row_id}", dependencies=[Depends(_PERM_MANAGE)])
async def update_row(row_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScrapWd).where(ScrapWd.id == row_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Riga non trovata")
    cleaned = _clean(body)
    for k, v in cleaned.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return _ser(row)


# ── DELETE by ids ────────────────────────────────────────────────────────────

@router.delete("", dependencies=[Depends(_PERM_MANAGE)])
async def delete_rows(payload: DeleteIdsRequest, db: AsyncSession = Depends(get_db)):
    if payload.ids:
        await db.execute(delete(ScrapWd).where(ScrapWd.id.in_(payload.ids)))
        await db.commit()
    return {"deleted": len(payload.ids)}
