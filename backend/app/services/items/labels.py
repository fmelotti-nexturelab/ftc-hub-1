"""Servizio per arricchimento dati etichette prezzo."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.items import ItemImportSession, ItemMasterIT01, Eccezione, ItemBestSeller


def _f(val):
    return float(val) if val is not None else None


def _clean_barcode(raw) -> str | None:
    """Normalizza barcode a 12-13 cifre."""
    if raw is None:
        return None
    bc = str(raw).strip().lstrip("0") if raw else ""
    bc = str(raw).strip()
    if not bc or bc == "0" or bc == "None":
        return None
    # Rimuovi eventuali .0 da conversione float
    if "." in bc:
        bc = bc.split(".")[0]
    ln = len(bc)
    if ln == 12:
        return bc
    if ln == 13:
        return bc[:12]
    if ln == 14:
        return bc[-12:]
    if ln > 14:
        return bc[-12:]
    # Pad a 12 cifre se troppo corto
    return bc.zfill(12) if ln < 12 else bc[:12]


def _calc_discount(first_rp_str: str | None, effective_price: float | None) -> float | None:
    """Calcola sconto % tra first_rp ed effective_price."""
    if not first_rp_str or not effective_price or effective_price <= 0:
        return None
    try:
        first_rp = float(str(first_rp_str).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None
    if first_rp <= 0 or first_rp <= effective_price:
        return None
    pct = round(((first_rp - effective_price) / first_rp) * 100, 0)
    return pct if pct > 0 else None


async def enrich_labels(db: AsyncSession, zebra_codes: list[str], mode: str = "normal") -> list[dict]:
    """Arricchisce una lista di codici zebra con dati prodotto, eccezioni e bestseller.

    mode: normal (IT01 master data) | promo | bf | advance | special
    Per ora solo 'normal' è implementato. Gli altri verranno aggiunti.
    """

    # 1. Sessione corrente IT01
    session_result = await db.execute(
        select(ItemImportSession.id)
        .where(ItemImportSession.entity == "IT01", ItemImportSession.is_current.is_(True))
    )
    session_id = session_result.scalar_one_or_none()
    if not session_id:
        return [{"zebra": z, "not_found": True} for z in zebra_codes]

    # 2. Prodotti (bulk query)
    items_result = await db.execute(
        select(ItemMasterIT01)
        .where(ItemMasterIT01.session_id == session_id,
               ItemMasterIT01.item_no.in_(zebra_codes))
    )
    items_map = {i.item_no: i for i in items_result.scalars().all()}

    # 3. Eccezioni (bulk query)
    ecc_result = await db.execute(
        select(Eccezione).where(Eccezione.zebra.in_(zebra_codes))
    )
    ecc_map = {e.zebra: e for e in ecc_result.scalars().all()}

    # 4. Bestseller (bulk query)
    bs_result = await db.execute(
        select(ItemBestSeller.item_no).where(ItemBestSeller.item_no.in_(zebra_codes))
    )
    bs_set = set(bs_result.scalars().all())

    # 5. Assembla risultati mantenendo l'ordine originale
    results = []
    for z in zebra_codes:
        item = items_map.get(z)
        if not item:
            results.append({"zebra": z, "not_found": True})
            continue

        ecc = ecc_map.get(z)
        unit_price = _f(item.unit_price)

        # Prezzo effettivo: eccezione sovrascrive
        effective_price = unit_price
        ecc_testo_prezzo = None
        ecc_sconto = None
        if ecc:
            if ecc.prezzo_1 is not None:
                effective_price = _f(ecc.prezzo_1)
            ecc_testo_prezzo = ecc.testo_prezzo
            ecc_sconto = ecc.sconto

        # Sconto %
        discount_pct = _calc_discount(item.first_rp, effective_price)

        results.append({
            "zebra": z,
            "not_found": False,
            "description": item.description_local or item.description or "",
            "description2": item.description2 or "",
            "net_weight": _f(item.net_weight),
            "unit_price": unit_price,
            "effective_price": effective_price,
            "first_rp": item.first_rp,
            "discount_pct": discount_pct,
            "barcode": _clean_barcode(item.barcode),
            "model_store": item.model_store,
            "category": item.category,
            "vat_pct": _f(item.vat_pct),
            "is_bestseller": z in bs_set,
            "ecc_testo_prezzo": ecc_testo_prezzo,
            "ecc_sconto": ecc_sconto,
        })

    return results
