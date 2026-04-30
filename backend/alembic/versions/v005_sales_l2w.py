"""sales_l2w: crea tabella vendite L2W e aggiorna ho.v_alldata

Revision ID: v005_sales_l2w
Revises: v004_kgl_add_kgl_l
Create Date: 2026-04-29
"""
from alembic import op

revision = "v005_sales_l2w"
down_revision = "v004_kgl_add_kgl_l"
branch_labels = None
depends_on = None

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS ho.sales_l2w (
    id         BIGSERIAL    PRIMARY KEY,
    item_no    VARCHAR(50)  NOT NULL,
    store_code VARCHAR(20)  NOT NULL,
    qty_sold   INTEGER      NOT NULL DEFAULT 0,
    week_from  VARCHAR(10)  NULL,
    week_to    VARCHAR(10)  NULL,
    synced_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    synced_by  UUID         REFERENCES auth.users(id) ON DELETE SET NULL
)
"""

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
  ),
  _sales_it01 AS (
    SELECT item_no,
      jsonb_object_agg(store_code, qty_sold) AS sales_it01
    FROM ho.sales_l2w WHERE store_code LIKE 'IT1%'
    GROUP BY item_no
  ),
  _sales_it02 AS (
    SELECT item_no,
      jsonb_object_agg(store_code, qty_sold) AS sales_it02
    FROM ho.sales_l2w WHERE store_code LIKE 'IT2%'
    GROUP BY item_no
  ),
  _sales_it03 AS (
    SELECT item_no,
      jsonb_object_agg(store_code, qty_sold) AS sales_it03
    FROM ho.sales_l2w WHERE store_code LIKE 'IT3%'
    GROUP BY item_no
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
  kgl.kgl_l,
  COALESCE(s1.adm_it01, 0) AS adm_it01,
  COALESCE(s2.adm_it02, 0) AS adm_it02,
  COALESCE(s3.adm_it03, 0) AS adm_it03,
  COALESCE(s1.stock_it01, '{}'::jsonb) AS stock_it01,
  COALESCE(s2.stock_it02, '{}'::jsonb) AS stock_it02,
  COALESCE(s3.stock_it03, '{}'::jsonb) AS stock_it03,
  COALESCE(sl1.sales_it01, '{}'::jsonb) AS sales_it01,
  COALESCE(sl2.sales_it02, '{}'::jsonb) AS sales_it02,
  COALESCE(sl3.sales_it03, '{}'::jsonb) AS sales_it03
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
LEFT JOIN _sales_it01 sl1 ON sl1.item_no = i.item_no
LEFT JOIN _sales_it02 sl2 ON sl2.item_no = i.item_no
LEFT JOIN _sales_it03 sl3 ON sl3.item_no = i.item_no
"""


def upgrade() -> None:
    op.execute(_CREATE_TABLE)
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_l2w_item_no    ON ho.sales_l2w (item_no)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_l2w_store_code ON ho.sales_l2w (store_code)")
    op.execute("DROP VIEW IF EXISTS ho.v_alldata")
    op.execute(_VIEW_SQL.replace("CREATE OR REPLACE VIEW", "CREATE VIEW"))


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS ho.v_alldata")
    op.execute("DROP TABLE IF EXISTS ho.sales_l2w")
