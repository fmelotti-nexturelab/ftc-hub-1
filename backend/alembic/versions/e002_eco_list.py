"""create ho.eco_list — articoli ECO da tbl_ECO.xlsx

Revision ID: e002_eco_list
Revises: e001_expo_list
Create Date: 2026-04-28
"""
from alembic import op

revision = "e002_eco_list"
down_revision = "e001_expo_list"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS ho.eco_list (
            item_no   TEXT        PRIMARY KEY,
            synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            synced_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ho.eco_list")
