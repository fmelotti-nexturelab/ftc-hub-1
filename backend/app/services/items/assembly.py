"""Assembly Engine: compone item_master_it01 dallo staging + tabelle di riferimento.

Logica MODEL STORE (priorità da variabili.txt PESO):
  1. KVI          → 'KVI'
  2. Campagne     → type_item della campagna (es. 'PROMO', 'KVI')
  3. SB List      → model_store_finale (es. 'SB')
  4. Core List    → type della riga core (es. 'CORE', 'PLANOGRAM ITEMS')
  5. Master Bi    → item_type_bi (es. 'NA CORE', 'TAIL', 'GAPFILLERS')
  6. default      → 'NA CORE'

MODULO NUMERICO (MAGAZZINO): ND=1, Table=2, Wall=3, Behind the till=4,
  Fridge=5, Card wall=6, Surprice bag area=7, Bin=8, Sales unit=9, Candle wall=10

MODEL STORE PORTALE NUMERICO (PESO): Clearance=1, Promo=2, Sb=3, Core=4,
  Seasonal=5, Current=6, Previous=7, Na Core=8, Gapfillers=9, Tail=10
"""
import random
import string
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _batch_id() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


ASSEMBLE_SQL = text("""
WITH assembled AS (
    SELECT
        r.item_no,
        r.description,
        r.description_local,
        r.warehouse,
        r.last_cost,
        r.unit_price,
        r.item_cat,
        r.net_weight,
        r.barcode,
        r.vat_code,
        r.units_per_pack,

        -- MODEL STORE (priority chain)
        CASE
            WHEN kvi.item_no  IS NOT NULL THEN 'KVI'
            WHEN camp.item_no IS NOT NULL THEN UPPER(COALESCE(camp.type_item, 'PROMO'))
            WHEN sb.item_no   IS NOT NULL THEN UPPER(COALESCE(sb.model_store_finale, 'SB'))
            WHEN core.item_no IS NOT NULL THEN UPPER(COALESCE(core.type, 'CORE'))
            ELSE UPPER(COALESCE(bi.item_type_bi, 'NA CORE'))
        END AS model_store,

        NULL::text AS batteries,
        pr.country_rp  AS first_rp,
        bi.category,
        bi.barcode_ext,
        iva.vat_pct,

        CASE
            WHEN r.unit_price IS NOT NULL AND r.unit_price > 0
            THEN ROUND(((r.unit_price - COALESCE(r.last_cost, 0)) / r.unit_price) * 100, 7)
            ELSE NULL
        END AS gm_pct,

        tr.descrizione1 AS description1,
        tr.descrizione2 AS description2,
        COALESCE(disp.modulo, 'ND') AS modulo,

        -- MODEL STORE PORTALE (uguale al model_store per ora)
        CASE
            WHEN kvi.item_no  IS NOT NULL THEN 'KVI'
            WHEN camp.item_no IS NOT NULL THEN UPPER(COALESCE(camp.type_item, 'PROMO'))
            WHEN sb.item_no   IS NOT NULL THEN UPPER(COALESCE(sb.model_store_finale, 'SB'))
            WHEN core.item_no IS NOT NULL THEN UPPER(COALESCE(core.type, 'CORE'))
            ELSE UPPER(COALESCE(bi.item_type_bi, 'NA CORE'))
        END AS model_store_portale,

        -- MODULO NUMERICO (MAGAZZINO priority)
        CASE COALESCE(disp.modulo, 'ND')
            WHEN 'ND'                THEN 1
            WHEN 'Table'             THEN 2
            WHEN 'Wall'              THEN 3
            WHEN 'Behind the till'   THEN 4
            WHEN 'Fridge'            THEN 5
            WHEN 'Card wall'         THEN 6
            WHEN 'Surprice bag area' THEN 7
            WHEN 'Bin'               THEN 8
            WHEN 'Sales unit'        THEN 9
            WHEN 'Candle wall'       THEN 10
            ELSE 1
        END AS modulo_numerico,

        -- MODEL STORE PORTALE NUMERICO (PESO priority)
        CASE
            WHEN kvi.item_no  IS NOT NULL THEN NULL
            WHEN camp.item_no IS NOT NULL THEN 2
            WHEN sb.item_no   IS NOT NULL THEN 3
            WHEN core.item_no IS NOT NULL THEN 4
            ELSE CASE UPPER(COALESCE(bi.item_type_bi, 'NA CORE'))
                WHEN 'CLEARANCE'       THEN 1
                WHEN 'PROMO'           THEN 2
                WHEN 'SB'              THEN 3
                WHEN 'CORE'            THEN 4
                WHEN 'PLANOGRAM ITEMS' THEN 4
                WHEN 'SEASONAL'        THEN 5
                WHEN 'CURRENT'         THEN 6
                WHEN 'PREVIOUS'        THEN 7
                WHEN 'NA CORE'         THEN 8
                WHEN 'GAPFILLERS'      THEN 9
                WHEN 'TAIL'            THEN 10
                ELSE 8
            END
        END AS model_store_portale_num

    FROM ho.item_raw_nav r
    LEFT JOIN ho.item_kvi             kvi  ON kvi.item_no  = r.item_no
    LEFT JOIN ho.item_campaigns_promo camp  ON camp.item_no = r.item_no
    LEFT JOIN ho.item_sb_list         sb    ON sb.item_no   = r.item_no
    LEFT JOIN ho.item_core_list       core  ON core.item_no = r.item_no
    LEFT JOIN ho.item_master_bi       bi    ON bi.item_no   = r.item_no
    LEFT JOIN ho.item_price           pr    ON pr.item_no   = r.item_no
    LEFT JOIN ho.item_iva             iva   ON iva.vat_code = r.vat_code
    LEFT JOIN ho.item_translations    tr    ON tr.item_no   = r.item_no
    LEFT JOIN ho.item_display         disp  ON disp.item_no = r.item_no
)
INSERT INTO ho.item_master_it01 (
    session_id, item_no, description, description_local, warehouse,
    last_cost, unit_price, item_cat, net_weight, barcode, vat_code,
    units_per_pack, model_store, batteries, first_rp, category,
    barcode_ext, vat_pct, gm_pct, description1, description2,
    modulo, model_store_portale, modulo_numerico, model_store_portale_num
)
SELECT
    :session_id,
    item_no, description, description_local, warehouse,
    last_cost, unit_price, item_cat, net_weight, barcode, vat_code,
    units_per_pack, model_store, batteries,
    CAST(first_rp AS numeric(12,4)),
    category,
    barcode_ext, vat_pct, gm_pct, description1, description2,
    modulo, model_store_portale,
    CAST(modulo_numerico AS numeric(12,4)),
    CAST(model_store_portale_num AS numeric(12,4))
FROM assembled
""")


async def run_assembly(db: AsyncSession, user_id: str) -> dict:
    """Assembla item_master_it01 dallo staging + reference tables.

    Crea una nuova sessione IT01 (is_current=True) e inserisce tutti gli articoli.
    Ritorna stats: session_id, row_count, duration_ms.
    """
    t0 = datetime.now(timezone.utc)

    # Conta righe staging
    raw_count = (await db.execute(text("SELECT COUNT(*) FROM ho.item_raw_nav"))).scalar()
    if not raw_count:
        raise ValueError("Staging vuoto: importa prima i dati grezzi Navision (Raw NAV)")

    batch = _batch_id()
    now_ts = t0

    # Marca vecchie sessioni IT01 come non correnti
    await db.execute(
        text("UPDATE ho.item_import_sessions SET is_current = FALSE WHERE entity = 'IT01'")
    )

    # Crea nuova sessione
    session_row = (await db.execute(
        text("""
            INSERT INTO ho.item_import_sessions
                (entity, batch_id, imported_by, row_count, source_filename, is_current, imported_at)
            VALUES
                ('IT01', :batch, CAST(:uid AS uuid), 0, 'Converter Assembly', TRUE, :now)
            RETURNING id
        """),
        {"batch": batch, "uid": user_id, "now": now_ts},
    )).one()
    session_id = session_row[0]

    # Assembly SQL
    result = await db.execute(ASSEMBLE_SQL, {"session_id": session_id})
    row_count = result.rowcount

    # Aggiorna row_count nella sessione
    await db.execute(
        text("UPDATE ho.item_import_sessions SET row_count = :n WHERE id = :sid"),
        {"n": row_count, "sid": session_id},
    )

    await db.commit()

    duration_ms = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
    return {
        "session_id": session_id,
        "batch_id":   batch,
        "row_count":  row_count,
        "duration_ms": duration_ms,
        "assembled_at": now_ts.isoformat(),
    }
