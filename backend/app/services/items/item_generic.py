"""Service generico per tabelle articoli con struttura identica a ItemMasterIT01."""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

# Campi stringa che vanno forzati a str
_STR_FIELDS = {
    "item_no", "description", "description_local", "warehouse",
    "item_cat", "vat_code", "model_store", "batteries",
    "first_rp", "category", "description1", "description2",
    "modulo", "model_store_portale",
}
# Campi numerici float/decimal
_FLOAT_FIELDS = {
    "last_cost", "unit_price", "net_weight", "vat_pct", "gm_pct",
    "modulo_numerico", "model_store_portale_num",
}
# Campi numerici interi
_INT_FIELDS = {"barcode", "barcode_ext", "units_per_pack"}
_ALL_FIELDS = _STR_FIELDS | _FLOAT_FIELDS | _INT_FIELDS


def clean_row(raw: dict) -> dict:
    """Converte i tipi dei campi per compatibilità con PostgreSQL."""
    out = {}
    for k, v in raw.items():
        if k not in _ALL_FIELDS:
            continue
        if v is None or v == "":
            if k in ("item_no", "description", "description_local"):
                out[k] = ""
            else:
                out[k] = None
            continue
        if k in _STR_FIELDS:
            out[k] = str(v).strip()
        elif k in _FLOAT_FIELDS:
            try:
                out[k] = float(str(v).replace(",", "."))
            except (ValueError, TypeError):
                out[k] = None
        elif k in _INT_FIELDS:
            try:
                out[k] = int(float(str(v)))
            except (ValueError, TypeError):
                out[k] = None
        else:
            out[k] = v
    return out


async def get_all(db: AsyncSession, model):
    result = await db.execute(select(model).order_by(model.item_no))
    return result.scalars().all()


async def replace_all(db: AsyncSession, model, rows: list[dict]) -> int:
    await db.execute(delete(model))
    cleaned = [clean_row(r) for r in rows]
    cleaned = [r for r in cleaned if r.get("item_no")]
    if cleaned:
        await db.execute(model.__table__.insert(), cleaned)
    await db.commit()
    return len(cleaned)
