from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.models.items import Eccezione, ItemBestSeller

router = APIRouter(prefix="/api/items/eccezioni", tags=["Items - Eccezioni & BestSeller"])

_PERM_VIEW = require_permission("items_view")
_PERM_MANAGE = require_permission("items_view", need_manage=True)


def _f(val):
    return float(val) if val is not None else None


def _ser_eccezione(i):
    return {
        "id": i.id, "zebra": i.zebra, "descrizione": i.descrizione,
        "prezzo_1": _f(i.prezzo_1), "prezzo_2": _f(i.prezzo_2),
        "sconto": i.sconto, "testo_prezzo": i.testo_prezzo,
        "categoria": i.categoria, "eccezione": i.eccezione,
        "testo_prezzo2": i.testo_prezzo2, "col11": i.col11, "col12": i.col12,
    }


def _ser_bestseller(i):
    return {"id": i.id, "item_no": i.item_no}


def _clean_eccezione(raw: dict) -> dict:
    out = {}
    str_fields = {"zebra", "descrizione", "sconto", "testo_prezzo", "categoria",
                  "eccezione", "testo_prezzo2", "col11", "col12"}
    float_fields = {"prezzo_1", "prezzo_2"}
    for k, v in raw.items():
        if k not in str_fields and k not in float_fields:
            continue
        if v is None or v == "":
            out[k] = None if k != "zebra" else ""
            continue
        if k in float_fields:
            try:
                out[k] = float(str(v).replace(",", "."))
            except (ValueError, TypeError):
                out[k] = None
        else:
            out[k] = str(v).strip()
    return out


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReplaceRequest(BaseModel):
    eccezioni: list[dict]
    bestseller: list[dict]

class AppendRowsRequest(BaseModel):
    rows: list[dict]

class DeleteIdsRequest(BaseModel):
    ids: list[int]


# ── GET all ───────────────────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(_PERM_VIEW)])
async def get_all(db: AsyncSession = Depends(get_db)):
    ecc_result = await db.execute(select(Eccezione).order_by(Eccezione.zebra))
    bs_result = await db.execute(select(ItemBestSeller).order_by(ItemBestSeller.item_no))
    return {
        "eccezioni": [_ser_eccezione(i) for i in ecc_result.scalars().all()],
        "bestseller": [_ser_bestseller(i) for i in bs_result.scalars().all()],
    }


# ── PUT replace all ──────────────────────────────────────────────────────────

@router.put("", dependencies=[Depends(_PERM_MANAGE)])
async def replace_all(payload: ReplaceRequest, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Eccezione))
    ecc_cleaned = [r for r in [_clean_eccezione(r) for r in payload.eccezioni] if r.get("zebra")]
    if ecc_cleaned:
        await db.execute(Eccezione.__table__.insert(), ecc_cleaned)

    await db.execute(delete(ItemBestSeller))
    bs_cleaned = [{"item_no": str(r.get("item_no", "")).strip()}
                  for r in payload.bestseller if r.get("item_no") not in (None, "")]
    if bs_cleaned:
        await db.execute(ItemBestSeller.__table__.insert(), bs_cleaned)

    await db.commit()
    return {"eccezioni_count": len(ecc_cleaned), "bestseller_count": len(bs_cleaned)}


# ── Eccezioni: append, update, delete ─────────────────────────────────────────

@router.post("/eccezioni", dependencies=[Depends(_PERM_MANAGE)])
async def append_eccezioni(payload: AppendRowsRequest, db: AsyncSession = Depends(get_db)):
    cleaned = [r for r in [_clean_eccezione(r) for r in payload.rows] if r.get("zebra")]
    if cleaned:
        await db.execute(Eccezione.__table__.insert(), cleaned)
    await db.commit()
    return {"count": len(cleaned)}


@router.patch("/eccezioni/{row_id}", dependencies=[Depends(_PERM_MANAGE)])
async def update_eccezione(row_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Eccezione).where(Eccezione.id == row_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Riga non trovata")
    cleaned = _clean_eccezione(body)
    for k, v in cleaned.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return _ser_eccezione(row)


@router.delete("/eccezioni", dependencies=[Depends(_PERM_MANAGE)])
async def delete_eccezioni(payload: DeleteIdsRequest, db: AsyncSession = Depends(get_db)):
    if payload.ids:
        await db.execute(delete(Eccezione).where(Eccezione.id.in_(payload.ids)))
        await db.commit()
    return {"deleted": len(payload.ids)}


# ── BestSeller: append, update, delete ────────────────────────────────────────

@router.post("/bestseller", dependencies=[Depends(_PERM_MANAGE)])
async def append_bestseller(payload: AppendRowsRequest, db: AsyncSession = Depends(get_db)):
    cleaned = [{"item_no": str(r.get("item_no", "")).strip()}
               for r in payload.rows if r.get("item_no") not in (None, "")]
    if cleaned:
        await db.execute(ItemBestSeller.__table__.insert(), cleaned)
    await db.commit()
    return {"count": len(cleaned)}


@router.patch("/bestseller/{row_id}", dependencies=[Depends(_PERM_MANAGE)])
async def update_bestseller(row_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ItemBestSeller).where(ItemBestSeller.id == row_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Riga non trovata")
    if "item_no" in body and body["item_no"]:
        row.item_no = str(body["item_no"]).strip()
    await db.commit()
    await db.refresh(row)
    return _ser_bestseller(row)


@router.delete("/bestseller", dependencies=[Depends(_PERM_MANAGE)])
async def delete_bestseller(payload: DeleteIdsRequest, db: AsyncSession = Depends(get_db)):
    if payload.ids:
        await db.execute(delete(ItemBestSeller).where(ItemBestSeller.id.in_(payload.ids)))
        await db.commit()
    return {"deleted": len(payload.ids)}
