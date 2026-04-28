"""change stock_items description columns from VARCHAR(500) to TEXT

Revision ID: s002_stock_items_desc_text
Revises: oc006_add_full_name_to_pool
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = "s002_stock_items_desc_text"
down_revision = "oc006_add_full_name_to_pool"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("stock_items", "description",
                    existing_type=sa.String(500),
                    type_=sa.Text(),
                    existing_nullable=False,
                    schema="ho")
    op.alter_column("stock_items", "description_local",
                    existing_type=sa.String(500),
                    type_=sa.Text(),
                    existing_nullable=False,
                    schema="ho")


def downgrade() -> None:
    op.alter_column("stock_items", "description_local",
                    existing_type=sa.Text(),
                    type_=sa.String(500),
                    existing_nullable=False,
                    schema="ho")
    op.alter_column("stock_items", "description",
                    existing_type=sa.Text(),
                    type_=sa.String(500),
                    existing_nullable=False,
                    schema="ho")
