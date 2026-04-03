"""add extra columns to item_master_it01 (modulo, model_store_portale, modulo_numerico, model_store_portale_num)

Revision ID: g003_add_itemmaster_extra_columns
Revises: s001_app_settings
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "g003_item_extra_cols"
down_revision = "s001_app_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("item_master_it01", sa.Column("modulo", sa.String(100), nullable=True), schema="ho")
    op.add_column("item_master_it01", sa.Column("model_store_portale", sa.String(100), nullable=True), schema="ho")
    op.add_column("item_master_it01", sa.Column("modulo_numerico", sa.Numeric(12, 4), nullable=True), schema="ho")
    op.add_column("item_master_it01", sa.Column("model_store_portale_num", sa.Numeric(12, 4), nullable=True), schema="ho")


def downgrade() -> None:
    op.drop_column("item_master_it01", "model_store_portale_num", schema="ho")
    op.drop_column("item_master_it01", "modulo_numerico", schema="ho")
    op.drop_column("item_master_it01", "model_store_portale", schema="ho")
    op.drop_column("item_master_it01", "modulo", schema="ho")
