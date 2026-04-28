"""create ho.kgl_list — peso corretto per articolo da tbl_KGL.xlsm

Revision ID: e003_kgl_list
Revises: e002_eco_list
Create Date: 2026-04-28
"""
from alembic import op

revision = "e003_kgl_list"
down_revision = "e002_eco_list"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS ho.kgl_list (
            item_no       TEXT           PRIMARY KEY,
            peso_corretto NUMERIC(10, 4) NOT NULL,
            synced_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
            synced_by     UUID           REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ho.kgl_list")
