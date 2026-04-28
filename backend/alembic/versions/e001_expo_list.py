"""create ho.expo_list — TABLE/WALL per articolo da tbl_ExpoList.xlsm

Revision ID: e001_expo_list
Revises: v002_alldata_view_multimaster
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = "e001_expo_list"
down_revision = "v002_alldata_view_multimaster"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS ho.expo_list (
            item_no     TEXT        PRIMARY KEY,
            expo_type   TEXT        NOT NULL CHECK (expo_type IN ('TABLE', 'WALL', 'BUCKET')),
            synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            synced_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_expo_list_expo_type ON ho.expo_list (expo_type)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ho.expo_list")
