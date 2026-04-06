"""refactor item_bestseller (solo item_no) e add eccezioni table

Revision ID: 5b2c3d4e5f6a
Revises: 4e4a1c646cb9
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5b2c3d4e5f6a'
down_revision: str = '4e4a1c646cb9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop e ricrea item_bestseller semplificata (era vuota)
    op.drop_index('ix_item_bestseller_item_no', table_name='item_bestseller', schema='ho')
    op.drop_table('item_bestseller', schema='ho')

    op.create_table('item_bestseller',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_no', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_item_bestseller_item_no', 'item_bestseller', ['item_no'], schema='ho')

    # Crea tabella eccezioni
    op.create_table('eccezioni',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('zebra', sa.String(length=50), nullable=False),
        sa.Column('descrizione', sa.String(length=500), nullable=True),
        sa.Column('prezzo_1', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('prezzo_2', sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column('sconto', sa.String(length=100), nullable=True),
        sa.Column('testo_prezzo', sa.String(length=500), nullable=True),
        sa.Column('categoria', sa.String(length=255), nullable=True),
        sa.Column('eccezione', sa.String(length=255), nullable=True),
        sa.Column('testo_prezzo2', sa.String(length=500), nullable=True),
        sa.Column('col11', sa.String(length=255), nullable=True),
        sa.Column('col12', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_eccezioni_zebra', 'eccezioni', ['zebra'], schema='ho')


def downgrade() -> None:
    op.drop_index('ix_eccezioni_zebra', table_name='eccezioni', schema='ho')
    op.drop_table('eccezioni', schema='ho')

    # Ricrea item_bestseller con tutte le colonne (versione originale)
    op.drop_index('ix_item_bestseller_item_no', table_name='item_bestseller', schema='ho')
    op.drop_table('item_bestseller', schema='ho')
    op.create_table('item_bestseller',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_no', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='ho'
    )
    op.create_index('ix_item_bestseller_item_no', 'item_bestseller', ['item_no'], schema='ho')
