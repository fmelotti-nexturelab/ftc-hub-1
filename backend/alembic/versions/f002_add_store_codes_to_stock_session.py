"""add store_codes_json to stock_sessions

Revision ID: f002_add_store_codes
Revises: f001_add_stock_tables
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "f002_add_store_codes"
down_revision = "f001_add_stock_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stock_sessions",
        sa.Column("store_codes_json", sa.Text(), nullable=True),
        schema="ho",
    )


def downgrade() -> None:
    op.drop_column("stock_sessions", "store_codes_json", schema="ho")
