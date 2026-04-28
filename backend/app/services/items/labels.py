"""Servizio per arricchimento dati etichette prezzo."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _f(val):
    return float(val) if val is not None else None


def _clean_barcode(raw) -> str | None:
    """Normalizza barcode a 12-13 cifre."""
    if raw is None:
        return None
    bc = str(raw).strip()
    if not bc or bc == "0" or bc == "None":
        return None
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


# Query ottimizzata: join diretto sulle tabelle base, LATERAL per promo/BF/eccezioni/bestseller.
# NON tocca le tabelle stock (stock_items / stock_store_data) perché le etichette non ne hanno bisogno.
# Il filtro WHERE avviene PRIMA dei LATERAL, quindi ogni lookup è un index-scan su pochi record.
_SQL_NO_BARCODE = text("""
    WITH _session AS (
        SELECT id FROM ho.item_import_sessions
        WHERE entity = 'IT01' AND is_current = true
        LIMIT 1
    )
    SELECT
        i.item_no,
        i.description,
        i.description_local,
        i.unit_price,
        i.first_rp,
        i.barcode,
        i.barcode_ext,
        i.net_weight,
        i.model_store,
        i.category,
        i.vat_pct,
        i.description2,
        pr.unit_price   AS prezzo_promo,
        bf.unit_price   AS prezzo_bf,
        ec.prezzo_1     AS eccezione_prezzo_1,
        ec.sconto       AS eccezione_sconto,
        ec.testo_prezzo AS eccezione_testo,
        (bs.item_no IS NOT NULL) AS is_bestseller,
        el.expo_type,
        (eco.item_no IS NOT NULL) AS is_eco,
        kgl.peso_corretto
    FROM ho.item_master_it01 i
    JOIN _session cs ON i.session_id = cs.id
    LEFT JOIN LATERAL (
        SELECT unit_price FROM ho.item_promo
        WHERE item_no = i.item_no AND is_active = true
        ORDER BY created_at DESC LIMIT 1
    ) pr ON true
    LEFT JOIN LATERAL (
        SELECT unit_price FROM ho.item_blackfriday
        WHERE item_no = i.item_no AND is_active = true
        ORDER BY created_at DESC LIMIT 1
    ) bf ON true
    LEFT JOIN LATERAL (
        SELECT prezzo_1, sconto, testo_prezzo FROM ho.eccezioni
        WHERE zebra = i.item_no AND is_active = true
        ORDER BY created_at DESC LIMIT 1
    ) ec ON true
    LEFT JOIN LATERAL (
        SELECT item_no FROM ho.item_bestseller
        WHERE item_no = i.item_no AND is_active = true
        LIMIT 1
    ) bs ON true
    LEFT JOIN ho.expo_list el  ON el.item_no  = i.item_no
    LEFT JOIN ho.eco_list  eco ON eco.item_no = i.item_no
    LEFT JOIN ho.kgl_list  kgl ON kgl.item_no = i.item_no
    WHERE i.item_no = ANY(:codes)
""")

_SQL_WITH_BARCODE = text("""
    WITH _session AS (
        SELECT id FROM ho.item_import_sessions
        WHERE entity = 'IT01' AND is_current = true
        LIMIT 1
    )
    SELECT
        i.item_no,
        i.description,
        i.description_local,
        i.unit_price,
        i.first_rp,
        i.barcode,
        i.barcode_ext,
        i.net_weight,
        i.model_store,
        i.category,
        i.vat_pct,
        i.description2,
        pr.unit_price   AS prezzo_promo,
        bf.unit_price   AS prezzo_bf,
        ec.prezzo_1     AS eccezione_prezzo_1,
        ec.sconto       AS eccezione_sconto,
        ec.testo_prezzo AS eccezione_testo,
        (bs.item_no IS NOT NULL) AS is_bestseller,
        el.expo_type,
        (eco.item_no IS NOT NULL) AS is_eco,
        kgl.peso_corretto
    FROM ho.item_master_it01 i
    JOIN _session cs ON i.session_id = cs.id
    LEFT JOIN LATERAL (
        SELECT unit_price FROM ho.item_promo
        WHERE item_no = i.item_no AND is_active = true
        ORDER BY created_at DESC LIMIT 1
    ) pr ON true
    LEFT JOIN LATERAL (
        SELECT unit_price FROM ho.item_blackfriday
        WHERE item_no = i.item_no AND is_active = true
        ORDER BY created_at DESC LIMIT 1
    ) bf ON true
    LEFT JOIN LATERAL (
        SELECT prezzo_1, sconto, testo_prezzo FROM ho.eccezioni
        WHERE zebra = i.item_no AND is_active = true
        ORDER BY created_at DESC LIMIT 1
    ) ec ON true
    LEFT JOIN LATERAL (
        SELECT item_no FROM ho.item_bestseller
        WHERE item_no = i.item_no AND is_active = true
        LIMIT 1
    ) bs ON true
    LEFT JOIN ho.expo_list el  ON el.item_no  = i.item_no
    LEFT JOIN ho.eco_list  eco ON eco.item_no = i.item_no
    LEFT JOIN ho.kgl_list  kgl ON kgl.item_no = i.item_no
    WHERE i.item_no = ANY(:codes)
       OR i.barcode     = ANY(:barcodes)
       OR i.barcode_ext = ANY(:barcodes)
""")


async def enrich_labels(db: AsyncSession, zebra_codes: list[str], mode: str = "normal") -> list[dict]:
    """Arricchisce una lista di codici zebra con dati prodotto e prezzi.

    Prezzi per modalità:
      normal / advance / special → unit_price
      promo                      → prezzo_promo  (fallback: unit_price)
      bf                         → prezzo_bf     (fallback: unit_price)
    In tutti i casi eccezione_prezzo_1 sovrascrive il prezzo base.
    """
    if not zebra_codes:
        return []

    barcode_ints: list[int] = []
    for z in zebra_codes:
        if z and z.isdigit():
            try:
                barcode_ints.append(int(z))
            except (ValueError, OverflowError):
                pass

    if barcode_ints:
        result = await db.execute(
            _SQL_WITH_BARCODE,
            {"codes": list(zebra_codes), "barcodes": barcode_ints},
        )
    else:
        result = await db.execute(
            _SQL_NO_BARCODE,
            {"codes": list(zebra_codes)},
        )

    rows = result.mappings().all()

    items_map: dict[str, dict] = {}
    for row in rows:
        if row["item_no"]:
            items_map[row["item_no"]] = row
        if row["barcode"] is not None:
            items_map[str(row["barcode"])] = row
        if row["barcode_ext"] is not None:
            items_map[str(row["barcode_ext"])] = row

    results = []
    for z in zebra_codes:
        row = items_map.get(z)
        if not row:
            results.append({"zebra": z, "requested_code": z, "not_found": True})
            continue

        unit_price    = _f(row["unit_price"])
        prezzo_promo  = _f(row["prezzo_promo"])
        prezzo_bf     = _f(row["prezzo_bf"])
        ecc_prezzo    = _f(row["eccezione_prezzo_1"])
        peso_corretto = _f(row["peso_corretto"])

        if mode == "promo":
            base_price = prezzo_promo if prezzo_promo is not None else unit_price
        elif mode == "bf":
            base_price = prezzo_bf if prezzo_bf is not None else unit_price
        else:
            base_price = unit_price

        effective_price = ecc_prezzo if ecc_prezzo is not None else base_price
        discount_pct    = _calc_discount(row["first_rp"], effective_price)

        desc2 = row["description2"] or ""
        if str(desc2).strip() in ("0", "0.0"):
            desc2 = ""

        results.append({
            "zebra":            row["item_no"],
            "requested_code":   z,
            "not_found":        False,
            "description":      row["description_local"] or row["description"] or "",
            "description2":     desc2,
            "net_weight":       peso_corretto if peso_corretto is not None else _f(row["net_weight"]),
            "unit_price":       unit_price,
            "prezzo_promo":     prezzo_promo,
            "prezzo_bf":        prezzo_bf,
            "effective_price":  effective_price,
            "first_rp":         row["first_rp"],
            "discount_pct":     discount_pct,
            "barcode":          _clean_barcode(row["barcode"]),
            "barcode_ext":      str(row["barcode_ext"]) if row["barcode_ext"] is not None else None,
            "model_store":      row["model_store"],
            "category":         row["category"],
            "vat_pct":          _f(row["vat_pct"]),
            "is_bestseller":    bool(row["is_bestseller"]),
            "is_eco":           bool(row["is_eco"]),
            "ecc_testo_prezzo": row["eccezione_testo"],
            "ecc_sconto":       row["eccezione_sconto"],
            "expo_type":        row["expo_type"],
        })

    return results
