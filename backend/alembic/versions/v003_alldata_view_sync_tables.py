"""update ho.v_alldata — aggiunge expo_type, is_eco, peso_corretto

Revision ID: v003_alldata_view_sync_tables
Revises: e003_kgl_list
Create Date: 2026-04-28
"""
from alembic import op

revision = "v003_alldata_view_sync_tables"
down_revision = "e003_kgl_list"
branch_labels = None
depends_on = None

_VIEW_SQL = """
CREATE OR REPLACE VIEW ho.v_alldata AS
WITH
  _item_sessions AS (
    SELECT id, entity,
      CASE entity WHEN 'IT01' THEN 1 WHEN 'IT02' THEN 2 ELSE 3 END AS priority
    FROM ho.item_import_sessions
    WHERE entity IN ('IT01', 'IT02', 'IT03') AND is_current = true
  ),
  _item_base AS (
    SELECT DISTINCT ON (i.item_no)
      i.id, i.session_id, i.item_no, i.description, i.description_local,
      i.warehouse, i.last_cost, i.unit_price, i.item_cat, i.net_weight,
      i.barcode, i.vat_code, i.units_per_pack, i.model_store, i.batteries,
      i.first_rp, i.category, i.barcode_ext, i.vat_pct, i.gm_pct,
      i.description1, i.description2, i.modulo, i.model_store_portale,
      i.modulo_numerico, i.model_store_portale_num
    FROM ho.item_master_it01 i
    JOIN _item_sessions s ON i.session_id = s.id
    ORDER BY i.item_no, s.priority
  ),
  _promo AS (
    SELECT DISTINCT ON (item_no)
      item_no, unit_price AS prezzo_promo, last_cost AS costo_promo
    FROM ho.item_promo WHERE is_active = true
    ORDER BY item_no, created_at DESC
  ),
  _bf AS (
    SELECT DISTINCT ON (item_no)
      item_no, unit_price AS prezzo_bf, last_cost AS costo_bf
    FROM ho.item_blackfriday WHERE is_active = true
    ORDER BY item_no, created_at DESC
  ),
  _eccezione AS (
    SELECT DISTINCT ON (zebra)
      zebra,
      prezzo_1      AS eccezione_prezzo_1,
      prezzo_2      AS eccezione_prezzo_2,
      sconto        AS eccezione_sconto,
      testo_prezzo  AS eccezione_testo,
      testo_prezzo2 AS eccezione_testo2,
      categoria     AS eccezione_categoria,
      eccezione     AS eccezione_tipo
    FROM ho.eccezioni WHERE is_active = true
    ORDER BY zebra, created_at DESC
  ),
  _bestseller AS (SELECT DISTINCT item_no FROM ho.item_bestseller WHERE is_active = true),
  _scrap_inv  AS (SELECT DISTINCT zebra   FROM ho.scrap_inv          WHERE is_active = true),
  _scrap_wd   AS (SELECT DISTINCT zebra   FROM ho.scrap_wd           WHERE is_active = true),
  _picking    AS (SELECT DISTINCT item_no FROM ho.item_picking        WHERE is_active = true),
  _stock_it01 AS (
    SELECT si.item_no, si.adm_stock AS adm_it01,
      COALESCE(jsonb_object_agg(sd.store_code, sd.quantity)
        FILTER (WHERE sd.store_code IS NOT NULL), '{}'::jsonb) AS stock_it01
    FROM ho.stock_items si
    LEFT JOIN ho.stock_store_data sd ON sd.item_id = si.id
    WHERE si.session_id = (
      SELECT id FROM ho.stock_sessions WHERE entity = 'IT01' ORDER BY stock_date DESC LIMIT 1)
    GROUP BY si.id, si.item_no, si.adm_stock
  ),
  _stock_it02 AS (
    SELECT si.item_no, si.adm_stock AS adm_it02,
      COALESCE(jsonb_object_agg(sd.store_code, sd.quantity)
        FILTER (WHERE sd.store_code IS NOT NULL), '{}'::jsonb) AS stock_it02
    FROM ho.stock_items si
    LEFT JOIN ho.stock_store_data sd ON sd.item_id = si.id
    WHERE si.session_id = (
      SELECT id FROM ho.stock_sessions WHERE entity = 'IT02' ORDER BY stock_date DESC LIMIT 1)
    GROUP BY si.id, si.item_no, si.adm_stock
  ),
  _stock_it03 AS (
    SELECT si.item_no, si.adm_stock AS adm_it03,
      COALESCE(jsonb_object_agg(sd.store_code, sd.quantity)
        FILTER (WHERE sd.store_code IS NOT NULL), '{}'::jsonb) AS stock_it03
    FROM ho.stock_items si
    LEFT JOIN ho.stock_store_data sd ON sd.item_id = si.id
    WHERE si.session_id = (
      SELECT id FROM ho.stock_sessions WHERE entity = 'IT03' ORDER BY stock_date DESC LIMIT 1)
    GROUP BY si.id, si.item_no, si.adm_stock
  )
SELECT
  i.item_no, i.description, i.description_local,
  i.warehouse, i.last_cost, i.unit_price, i.item_cat, i.net_weight,
  i.barcode, i.vat_code, i.units_per_pack, i.model_store, i.batteries,
  i.first_rp, i.category, i.barcode_ext, i.vat_pct, i.gm_pct,
  i.description1, i.description2, i.modulo, i.model_store_portale,
  i.modulo_numerico, i.model_store_portale_num,
  pr.prezzo_promo, pr.costo_promo,
  bf.prezzo_bf,    bf.costo_bf,
  ec.eccezione_prezzo_1, ec.eccezione_prezzo_2,
  ec.eccezione_sconto,   ec.eccezione_testo,
  ec.eccezione_testo2,   ec.eccezione_categoria, ec.eccezione_tipo,
  (bs.item_no  IS NOT NULL) AS is_bestseller,
  (siv.zebra   IS NOT NULL) AS is_scrap_inv,
  (swd.zebra   IS NOT NULL) AS is_scrap_wd,
  (pk.item_no  IS NOT NULL) AS is_picking,
  el.expo_type,
  (eco.item_no IS NOT NULL) AS is_eco,
  kgl.peso_corretto,
  COALESCE(s1.adm_it01, 0) AS adm_it01,
  COALESCE(s2.adm_it02, 0) AS adm_it02,
  COALESCE(s3.adm_it03, 0) AS adm_it03,
  COALESCE(s1.stock_it01, '{}'::jsonb) AS stock_it01,
  COALESCE(s2.stock_it02, '{}'::jsonb) AS stock_it02,
  COALESCE(s3.stock_it03, '{}'::jsonb) AS stock_it03
FROM _item_base i
LEFT JOIN _promo      pr  ON pr.item_no  = i.item_no
LEFT JOIN _bf         bf  ON bf.item_no  = i.item_no
LEFT JOIN _eccezione  ec  ON ec.zebra    = i.item_no
LEFT JOIN _bestseller bs  ON bs.item_no  = i.item_no
LEFT JOIN _scrap_inv  siv ON siv.zebra   = i.item_no
LEFT JOIN _scrap_wd   swd ON swd.zebra   = i.item_no
LEFT JOIN _picking    pk  ON pk.item_no  = i.item_no
LEFT JOIN ho.expo_list el  ON el.item_no  = i.item_no
LEFT JOIN ho.eco_list  eco ON eco.item_no = i.item_no
LEFT JOIN ho.kgl_list  kgl ON kgl.item_no = i.item_no
LEFT JOIN _stock_it01 s1  ON s1.item_no  = i.item_no
LEFT JOIN _stock_it02 s2  ON s2.item_no  = i.item_no
LEFT JOIN _stock_it03 s3  ON s3.item_no  = i.item_no
"""

_VIEW_SQL_DOWN = """
CREATE OR REPLACE VIEW ho.v_alldata AS
WITH
  _item_sessions AS (
    SELECT id, entity,
      CASE entity WHEN 'IT01' THEN 1 WHEN 'IT02' THEN 2 ELSE 3 END AS priority
    FROM ho.item_import_sessions
    WHERE entity IN ('IT01', 'IT02', 'IT03') AND is_current = true
  ),
  _item_base AS (
    SELECT DISTINCT ON (i.item_no)
      i.id, i.session_id, i.item_no, i.description, i.description_local,
      i.warehouse, i.last_cost, i.unit_price, i.item_cat, i.net_weight,
      i.barcode, i.vat_code, i.units_per_pack, i.model_store, i.batteries,
      i.first_rp, i.category, i.barcode_ext, i.vat_pct, i.gm_pct,
      i.description1, i.description2, i.modulo, i.model_store_portale,
      i.modulo_numerico, i.model_store_portale_num
    FROM ho.item_master_it01 i
    JOIN _item_sessions s ON i.session_id = s.id
    ORDER BY i.item_no, s.priority
  ),
  _promo AS (SELECT DISTINCT ON (item_no) item_no, unit_price AS prezzo_promo, last_cost AS costo_promo FROM ho.item_promo WHERE is_active = true ORDER BY item_no, created_at DESC),
  _bf AS (SELECT DISTINCT ON (item_no) item_no, unit_price AS prezzo_bf, last_cost AS costo_bf FROM ho.item_blackfriday WHERE is_active = true ORDER BY item_no, created_at DESC),
  _eccezione AS (SELECT DISTINCT ON (zebra) zebra, prezzo_1 AS eccezione_prezzo_1, prezzo_2 AS eccezione_prezzo_2, sconto AS eccezione_sconto, testo_prezzo AS eccezione_testo, testo_prezzo2 AS eccezione_testo2, categoria AS eccezione_categoria, eccezione AS eccezione_tipo FROM ho.eccezioni WHERE is_active = true ORDER BY zebra, created_at DESC),
  _bestseller AS (SELECT DISTINCT item_no FROM ho.item_bestseller WHERE is_active = true),
  _scrap_inv  AS (SELECT DISTINCT zebra   FROM ho.scrap_inv          WHERE is_active = true),
  _scrap_wd   AS (SELECT DISTINCT zebra   FROM ho.scrap_wd           WHERE is_active = true),
  _picking    AS (SELECT DISTINCT item_no FROM ho.item_picking        WHERE is_active = true),
  _stock_it01 AS (SELECT si.item_no, si.adm_stock AS adm_it01, COALESCE(jsonb_object_agg(sd.store_code, sd.quantity) FILTER (WHERE sd.store_code IS NOT NULL), '{}'::jsonb) AS stock_it01 FROM ho.stock_items si LEFT JOIN ho.stock_store_data sd ON sd.item_id = si.id WHERE si.session_id = (SELECT id FROM ho.stock_sessions WHERE entity = 'IT01' ORDER BY stock_date DESC LIMIT 1) GROUP BY si.id, si.item_no, si.adm_stock),
  _stock_it02 AS (SELECT si.item_no, si.adm_stock AS adm_it02, COALESCE(jsonb_object_agg(sd.store_code, sd.quantity) FILTER (WHERE sd.store_code IS NOT NULL), '{}'::jsonb) AS stock_it02 FROM ho.stock_items si LEFT JOIN ho.stock_store_data sd ON sd.item_id = si.id WHERE si.session_id = (SELECT id FROM ho.stock_sessions WHERE entity = 'IT02' ORDER BY stock_date DESC LIMIT 1) GROUP BY si.id, si.item_no, si.adm_stock),
  _stock_it03 AS (SELECT si.item_no, si.adm_stock AS adm_it03, COALESCE(jsonb_object_agg(sd.store_code, sd.quantity) FILTER (WHERE sd.store_code IS NOT NULL), '{}'::jsonb) AS stock_it03 FROM ho.stock_items si LEFT JOIN ho.stock_store_data sd ON sd.item_id = si.id WHERE si.session_id = (SELECT id FROM ho.stock_sessions WHERE entity = 'IT03' ORDER BY stock_date DESC LIMIT 1) GROUP BY si.id, si.item_no, si.adm_stock)
SELECT i.item_no, i.description, i.description_local, i.warehouse, i.last_cost, i.unit_price,
  i.item_cat, i.net_weight, i.barcode, i.vat_code, i.units_per_pack, i.model_store, i.batteries,
  i.first_rp, i.category, i.barcode_ext, i.vat_pct, i.gm_pct, i.description1, i.description2,
  i.modulo, i.model_store_portale, i.modulo_numerico, i.model_store_portale_num,
  pr.prezzo_promo, pr.costo_promo, bf.prezzo_bf, bf.costo_bf,
  ec.eccezione_prezzo_1, ec.eccezione_prezzo_2, ec.eccezione_sconto, ec.eccezione_testo,
  ec.eccezione_testo2, ec.eccezione_categoria, ec.eccezione_tipo,
  (bs.item_no IS NOT NULL) AS is_bestseller, (siv.zebra IS NOT NULL) AS is_scrap_inv,
  (swd.zebra IS NOT NULL) AS is_scrap_wd, (pk.item_no IS NOT NULL) AS is_picking,
  COALESCE(s1.adm_it01, 0) AS adm_it01, COALESCE(s2.adm_it02, 0) AS adm_it02, COALESCE(s3.adm_it03, 0) AS adm_it03,
  COALESCE(s1.stock_it01, '{}'::jsonb) AS stock_it01, COALESCE(s2.stock_it02, '{}'::jsonb) AS stock_it02, COALESCE(s3.stock_it03, '{}'::jsonb) AS stock_it03
FROM _item_base i
LEFT JOIN _promo pr ON pr.item_no = i.item_no LEFT JOIN _bf bf ON bf.item_no = i.item_no
LEFT JOIN _eccezione ec ON ec.zebra = i.item_no LEFT JOIN _bestseller bs ON bs.item_no = i.item_no
LEFT JOIN _scrap_inv siv ON siv.zebra = i.item_no LEFT JOIN _scrap_wd swd ON swd.zebra = i.item_no
LEFT JOIN _picking pk ON pk.item_no = i.item_no
LEFT JOIN _stock_it01 s1 ON s1.item_no = i.item_no LEFT JOIN _stock_it02 s2 ON s2.item_no = i.item_no
LEFT JOIN _stock_it03 s3 ON s3.item_no = i.item_no
"""


def upgrade() -> None:
    op.execute("DROP VIEW IF EXISTS ho.v_alldata")
    op.execute(_VIEW_SQL.replace("CREATE OR REPLACE VIEW", "CREATE VIEW"))


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS ho.v_alldata")
    op.execute(_VIEW_SQL_DOWN.replace("CREATE OR REPLACE VIEW", "CREATE VIEW"))
