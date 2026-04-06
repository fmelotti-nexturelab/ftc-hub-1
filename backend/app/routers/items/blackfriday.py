from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission
from app.database import get_db
from app.models.items import ItemBlackFriday
from app.services.items.item_generic import get_all, replace_all

router = APIRouter(prefix="/api/items/blackfriday", tags=["Items - BlackFriday"])

_PERM_VIEW = require_permission("items_view")
_PERM_MANAGE = require_permission("items_view", need_manage=True)


def _f(val):
    return float(val) if val is not None else None


def _serialize(i):
    return {
        "id": i.id, "item_no": i.item_no,
        "description": i.description, "description_local": i.description_local,
        "warehouse": i.warehouse, "last_cost": _f(i.last_cost),
        "unit_price": _f(i.unit_price), "item_cat": i.item_cat,
        "net_weight": _f(i.net_weight), "barcode": i.barcode,
        "vat_code": i.vat_code, "units_per_pack": i.units_per_pack,
        "model_store": i.model_store, "batteries": i.batteries,
        "first_rp": i.first_rp, "category": i.category,
        "barcode_ext": i.barcode_ext, "vat_pct": _f(i.vat_pct),
        "gm_pct": _f(i.gm_pct), "description1": i.description1,
        "description2": i.description2, "modulo": i.modulo,
        "model_store_portale": i.model_store_portale,
        "modulo_numerico": _f(i.modulo_numerico),
        "model_store_portale_num": _f(i.model_store_portale_num),
        "is_active": i.is_active,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


class ReplaceRequest(BaseModel):
    rows: list[dict]


@router.get("", dependencies=[Depends(_PERM_VIEW)])
async def list_items(db: AsyncSession = Depends(get_db)):
    return [_serialize(i) for i in await get_all(db, ItemBlackFriday)]


@router.put("", dependencies=[Depends(_PERM_MANAGE)])
async def replace_items(payload: ReplaceRequest, db: AsyncSession = Depends(get_db)):
    count = await replace_all(db, ItemBlackFriday, payload.rows)
    return {"row_count": count}
