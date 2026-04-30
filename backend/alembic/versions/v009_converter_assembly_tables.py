"""converter_assembly_tables: staging Raw NAV + Price, Translations, BoxSize, Display, MasterBi

Revision ID: v009_converter_assembly_tables
Revises: v008_converter_ref_tables
Create Date: 2026-04-30
"""
from alembic import op

revision = "v009_converter_assembly_tables"
down_revision = "v008_converter_ref_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE ho.item_raw_nav (
            id                BIGSERIAL     PRIMARY KEY,
            item_no           VARCHAR(50)   NOT NULL,
            description       VARCHAR(500),
            description_local VARCHAR(500),
            warehouse         VARCHAR(50),
            last_cost         NUMERIC(12,4),
            unit_price        NUMERIC(12,4),
            item_cat          VARCHAR(100),
            net_weight        NUMERIC(10,4),
            barcode           BIGINT,
            vat_code          VARCHAR(50),
            units_per_pack    INTEGER,
            synced_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
            synced_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX ix_item_raw_nav_item_no ON ho.item_raw_nav(item_no)")

    op.execute("""
        CREATE TABLE ho.item_price (
            item_no    VARCHAR(50)  PRIMARY KEY,
            country_rp NUMERIC(12,4),
            synced_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
            synced_by  UUID         REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)

    op.execute("""
        CREATE TABLE ho.item_translations (
            item_no      VARCHAR(50)  PRIMARY KEY,
            descrizione1 VARCHAR(500),
            descrizione2 VARCHAR(500),
            synced_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            synced_by    UUID         REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)

    op.execute("""
        CREATE TABLE ho.item_box_size (
            item_no   VARCHAR(50) PRIMARY KEY,
            box_size  INTEGER,
            synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            synced_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)

    op.execute("""
        CREATE TABLE ho.item_display (
            item_no              VARCHAR(50)  PRIMARY KEY,
            vm_module            VARCHAR(100),
            flag_hanging_display BOOLEAN,
            modulo               VARCHAR(100),
            synced_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
            synced_by            UUID         REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)

    op.execute("""
        CREATE TABLE ho.item_master_bi (
            item_no      VARCHAR(50)  PRIMARY KEY,
            category     VARCHAR(100),
            subcategory  VARCHAR(200),
            barcode_ext  BIGINT,
            item_type_bi VARCHAR(100),
            synced_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            synced_by    UUID         REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)


def downgrade() -> None:
    for t in ["item_master_bi", "item_display", "item_box_size",
              "item_translations", "item_price", "item_raw_nav"]:
        op.execute(f"DROP TABLE IF EXISTS ho.{t}")
