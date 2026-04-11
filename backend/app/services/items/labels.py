"""Servizio per arricchimento dati etichette prezzo."""

from sqlalchemy import select, or_
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

    # 2. Prodotti (bulk query: cerca per item_no OR barcode)
    # I codici numerici lunghi (es. 12+ cifre) sono probabilmente barcode; li convertiamo
    # in int per la colonna barcode (BigInteger).
    barcode_ints = []
    for z in zebra_codes:
        if z and z.isdigit():
            try:
                barcode_ints.append(int(z))
            except (ValueError, OverflowError):
                pass

    where_clauses = [ItemMasterIT01.item_no.in_(zebra_codes)]
    if barcode_ints:
        where_clauses.append(ItemMasterIT01.barcode.in_(barcode_ints))
        where_clauses.append(ItemMasterIT01.barcode_ext.in_(barcode_ints))

    items_result = await db.execute(
        select(ItemMasterIT01)
        .where(
            ItemMasterIT01.session_id == session_id,
            or_(*where_clauses),
        )
    )
    items_found = items_result.scalars().all()

    # Lookup per item_no (stringa), barcode e barcode_ext (int serializzati come stringa)
    items_map: dict[str, ItemMasterIT01] = {}
    resolved_item_nos: set[str] = set()
    for i in items_found:
        if i.item_no:
            items_map[i.item_no] = i
            resolved_item_nos.add(i.item_no)
        if i.barcode is not None:
            items_map[str(i.barcode)] = i
        if i.barcode_ext is not None:
            items_map[str(i.barcode_ext)] = i

    # 3. Eccezioni e bestseller vanno cercati per item_no risolto (non per requested code,
    # perché se l'utente ha passato un barcode l'item_no effettivo è diverso)
    lookup_item_nos = list(resolved_item_nos)

    if lookup_item_nos:
        ecc_result = await db.execute(
            select(Eccezione).where(Eccezione.zebra.in_(lookup_item_nos))
        )
        ecc_map = {e.zebra: e for e in ecc_result.scalars().all()}

        bs_result = await db.execute(
            select(ItemBestSeller.item_no).where(ItemBestSeller.item_no.in_(lookup_item_nos))
        )
        bs_set = set(bs_result.scalars().all())
    else:
        ecc_map = {}
        bs_set = set()

    # 5. Assembla risultati mantenendo l'ordine originale
    results = []
    for z in zebra_codes:
        item = items_map.get(z)
        if not item:
            results.append({"zebra": z, "requested_code": z, "not_found": True})
            continue

        # Le eccezioni sono keyate per zebra (item_no), non barcode
        ecc = ecc_map.get(item.item_no)
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

        # description2: ignora valori "0" / "0.0" (placeholder NAV per campo vuoto)
        desc2 = item.description2 or ""
        if str(desc2).strip() in ("0", "0.0"):
            desc2 = ""

        results.append({
            "zebra": item.item_no,
            "requested_code": z,
            "not_found": False,
            "description": item.description_local or item.description or "",
            "description2": desc2,
            "net_weight": _f(item.net_weight),
            "unit_price": unit_price,
            "effective_price": effective_price,
            "first_rp": item.first_rp,
            "discount_pct": discount_pct,
            "barcode": _clean_barcode(item.barcode),
            "barcode_ext": str(item.barcode_ext) if item.barcode_ext is not None else None,
            "model_store": item.model_store,
            "category": item.category,
            "vat_pct": _f(item.vat_pct),
            "is_bestseller": item.item_no in bs_set,
            "ecc_testo_prezzo": ecc_testo_prezzo,
            "ecc_sconto": ecc_sconto,
        })

    return results
