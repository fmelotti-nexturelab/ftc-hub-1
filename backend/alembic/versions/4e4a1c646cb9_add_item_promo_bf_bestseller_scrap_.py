"""add_item_promo_bf_bestseller_scrap_picking_tables

Revision ID: 4e4a1c646cb9
Revises: 7a493e73cc81
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4e4a1c646cb9'
down_revision: str = '7a493e73cc81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── item_promo ────────────────────────────────────────────────────────────
    op.create_table('item_promo',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_no', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('description_local', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('warehouse', sa.String(length=50), nullable=True),
        sa.Column('last_cost', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('item_cat', sa.String(length=100), nullable=True),
        sa.Column('net_weight', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('barcode', sa.BigInteger(), nullable=True),
        sa.Column('vat_code', sa.String(length=50), nullable=True),
        sa.Column('units_per_pack', sa.Integer(), nullable=True),
        sa.Column('model_store', sa.String(length=100), nullable=True),
        sa.Column('batteries', sa.String(length=100), nullable=True),
        sa.Column('first_rp', sa.String(length=100), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('barcode_ext', sa.BigInteger(), nullable=True),
        sa.Column('vat_pct', sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column('gm_pct', sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column('description1', sa.String(length=500), nullable=True),
        sa.Column('description2', sa.String(length=500), nullable=True),
        sa.Column('modulo', sa.String(length=100), nullable=True),
        sa.Column('model_store_portale', sa.String(length=100), nullable=True),
        sa.Column('modulo_numerico', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('model_store_portale_num', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_item_promo_item_no', 'item_promo', ['item_no'], schema='ho')

    # ── item_blackfriday ──────────────────────────────────────────────────────
    op.create_table('item_blackfriday',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_no', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('description_local', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('warehouse', sa.String(length=50), nullable=True),
        sa.Column('last_cost', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('item_cat', sa.String(length=100), nullable=True),
        sa.Column('net_weight', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('barcode', sa.BigInteger(), nullable=True),
        sa.Column('vat_code', sa.String(length=50), nullable=True),
        sa.Column('units_per_pack', sa.Integer(), nullable=True),
        sa.Column('model_store', sa.String(length=100), nullable=True),
        sa.Column('batteries', sa.String(length=100), nullable=True),
        sa.Column('first_rp', sa.String(length=100), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('barcode_ext', sa.BigInteger(), nullable=True),
        sa.Column('vat_pct', sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column('gm_pct', sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column('description1', sa.String(length=500), nullable=True),
        sa.Column('description2', sa.String(length=500), nullable=True),
        sa.Column('modulo', sa.String(length=100), nullable=True),
        sa.Column('model_store_portale', sa.String(length=100), nullable=True),
        sa.Column('modulo_numerico', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('model_store_portale_num', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_item_blackfriday_item_no', 'item_blackfriday', ['item_no'], schema='ho')

    # ── item_bestseller ───────────────────────────────────────────────────────
    op.create_table('item_bestseller',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_no', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('description_local', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('warehouse', sa.String(length=50), nullable=True),
        sa.Column('last_cost', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('item_cat', sa.String(length=100), nullable=True),
        sa.Column('net_weight', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('barcode', sa.BigInteger(), nullable=True),
        sa.Column('vat_code', sa.String(length=50), nullable=True),
        sa.Column('units_per_pack', sa.Integer(), nullable=True),
        sa.Column('model_store', sa.String(length=100), nullable=True),
        sa.Column('batteries', sa.String(length=100), nullable=True),
        sa.Column('first_rp', sa.String(length=100), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('barcode_ext', sa.BigInteger(), nullable=True),
        sa.Column('vat_pct', sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column('gm_pct', sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column('description1', sa.String(length=500), nullable=True),
        sa.Column('description2', sa.String(length=500), nullable=True),
        sa.Column('modulo', sa.String(length=100), nullable=True),
        sa.Column('model_store_portale', sa.String(length=100), nullable=True),
        sa.Column('modulo_numerico', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('model_store_portale_num', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_item_bestseller_item_no', 'item_bestseller', ['item_no'], schema='ho')

    # ── scrap_inv ─────────────────────────────────────────────────────────────
    op.create_table('scrap_inv',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_no', sa.String(length=50), nullable=False),
        sa.Column('scrap', sa.String(length=255), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_scrap_inv_item_no', 'scrap_inv', ['item_no'], schema='ho')

    # ── scrap_wd ──────────────────────────────────────────────────────────────
    op.create_table('scrap_wd',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_no', sa.String(length=50), nullable=False),
        sa.Column('bloccato', sa.String(length=255), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_scrap_wd_item_no', 'scrap_wd', ['item_no'], schema='ho')

    # ── item_picking ──────────────────────────────────────────────────────────
    op.create_table('item_picking',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_no', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_item_picking_item_no', 'item_picking', ['item_no'], schema='ho')


def downgrade() -> None:
    op.drop_index('ix_item_picking_item_no', table_name='item_picking', schema='ho')
    op.drop_table('item_picking', schema='ho')
    op.drop_index('ix_scrap_wd_item_no', table_name='scrap_wd', schema='ho')
    op.drop_table('scrap_wd', schema='ho')
    op.drop_index('ix_scrap_inv_item_no', table_name='scrap_inv', schema='ho')
    op.drop_table('scrap_inv', schema='ho')
    op.drop_index('ix_item_bestseller_item_no', table_name='item_bestseller', schema='ho')
    op.drop_table('item_bestseller', schema='ho')
    op.drop_index('ix_item_blackfriday_item_no', table_name='item_blackfriday', schema='ho')
    op.drop_table('item_blackfriday', schema='ho')
    op.drop_index('ix_item_promo_item_no', table_name='item_promo', schema='ho')
    op.drop_table('item_promo', schema='ho')
