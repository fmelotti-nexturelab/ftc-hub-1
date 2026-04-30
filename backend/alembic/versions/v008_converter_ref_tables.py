"""converter_ref_tables: KVI, SB List, Core List, Campagne Promo, IVA

Revision ID: v008_converter_ref_tables
Revises: v007_daily_tasks
Create Date: 2026-04-30
"""
from alembic import op

revision = "v008_converter_ref_tables"
down_revision = "v007_daily_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE ho.item_kvi (
            id        BIGSERIAL    PRIMARY KEY,
            item_no   VARCHAR(50)  NOT NULL,
            item_name VARCHAR(500),
            type      VARCHAR(50)  DEFAULT 'KVI',
            synced_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
            synced_by UUID         REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX ix_item_kvi_item_no ON ho.item_kvi(item_no)")

    op.execute("""
        CREATE TABLE ho.item_sb_list (
            id                  BIGSERIAL    PRIMARY KEY,
            item_no             VARCHAR(50)  NOT NULL,
            promo_name          VARCHAR(255),
            data_variazione     TIMESTAMPTZ,
            model_store_finale  VARCHAR(100),
            synced_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
            synced_by           UUID         REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX ix_item_sb_list_item_no ON ho.item_sb_list(item_no)")

    op.execute("""
        CREATE TABLE ho.item_core_list (
            id              BIGSERIAL    PRIMARY KEY,
            item_no         VARCHAR(50)  NOT NULL,
            ax_module_code  VARCHAR(255),
            type            VARCHAR(100),
            type_original   VARCHAR(100),
            synced_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
            synced_by       UUID         REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX ix_item_core_list_item_no ON ho.item_core_list(item_no)")

    op.execute("""
        CREATE TABLE ho.item_campaigns_promo (
            id                  BIGSERIAL       PRIMARY KEY,
            item_no             VARCHAR(50)     NOT NULL,
            promo_name          VARCHAR(255),
            prezzo_attuale      NUMERIC(10,4),
            prezzo_precedente   NUMERIC(10,4),
            data_variazione     TIMESTAMPTZ,
            fine_variazione     TIMESTAMPTZ,
            fine_promo          TIMESTAMPTZ,
            type_item           VARCHAR(100),
            type_after_promo    VARCHAR(100),
            promo_in_cassa_pct  NUMERIC(6,2),
            prezzo_netto        NUMERIC(10,4),
            status              VARCHAR(100),
            synced_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
            synced_by           UUID            REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX ix_item_campaigns_promo_item_no ON ho.item_campaigns_promo(item_no)")

    op.execute("""
        CREATE TABLE ho.item_iva (
            vat_code   VARCHAR(50) PRIMARY KEY,
            vat_pct    INTEGER     NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        INSERT INTO ho.item_iva (vat_code, vat_pct) VALUES
            ('BTW22',  22),
            ('BTW10',  10),
            ('BTW5',    5),
            ('BTW4',    4),
            ('ES 124',  0)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ho.item_iva")
    op.execute("DROP TABLE IF EXISTS ho.item_campaigns_promo")
    op.execute("DROP TABLE IF EXISTS ho.item_core_list")
    op.execute("DROP TABLE IF EXISTS ho.item_sb_list")
    op.execute("DROP TABLE IF EXISTS ho.item_kvi")
