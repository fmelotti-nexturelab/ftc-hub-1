from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.models.items import ItemPicking

router = APIRouter(prefix="/api/items/picking", tags=["Items - Picking"])

_PERM_VIEW = require_permission("items_view")
_PERM_MANAGE = require_permission("items_view", need_manage=True)


def _ser(i):
    return {"id": i.id, "item_no": i.item_no}


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
    result = await db.execute(select(ItemPicking).order_by(ItemPicking.item_no))
    return {"rows": [_ser(i) for i in result.scalars().all()]}


# ── PUT replace all ─────────────────────────────────────────────────────────

@router.put("", dependencies=[Depends(_PERM_MANAGE)])
async def replace_all(payload: ReplaceRequest, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ItemPicking))
    cleaned = [{"item_no": str(r.get("item_no", "")).strip()}
               for r in payload.rows if r.get("item_no") not in (None, "")]
    if cleaned:
        await db.execute(ItemPicking.__table__.insert(), cleaned)
    await db.commit()
    return {"count": len(cleaned)}


# ── POST append ──────────────────────────────────────────────────────────────

@router.post("", dependencies=[Depends(_PERM_MANAGE)])
async def append_rows(payload: AppendRowsRequest, db: AsyncSession = Depends(get_db)):
    cleaned = [{"item_no": str(r.get("item_no", "")).strip()}
               for r in payload.rows if r.get("item_no") not in (None, "")]
    if cleaned:
        await db.execute(ItemPicking.__table__.insert(), cleaned)
    await db.commit()
    return {"count": len(cleaned)}


# ── PATCH single row ────────────────────────────────────────────────────────

@router.patch("/{row_id}", dependencies=[Depends(_PERM_MANAGE)])
async def update_row(row_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ItemPicking).where(ItemPicking.id == row_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Riga non trovata")
    if "item_no" in body and body["item_no"]:
        row.item_no = str(body["item_no"]).strip()
    await db.commit()
    await db.refresh(row)
    return _ser(row)


# ── DELETE by ids ────────────────────────────────────────────────────────────

@router.delete("", dependencies=[Depends(_PERM_MANAGE)])
async def delete_rows(payload: DeleteIdsRequest, db: AsyncSession = Depends(get_db)):
    if payload.ids:
        await db.execute(delete(ItemPicking).where(ItemPicking.id.in_(payload.ids)))
        await db.commit()
    return {"deleted": len(payload.ids)}
