"""rename scrap_inv columns: item_no->zebra, description->descrizione, category->categoria

Revision ID: 6c3d4e5f6a7b
Revises: 5b2c3d4e5f6a
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op


revision: str = '6c3d4e5f6a7b'
down_revision: str = '5b2c3d4e5f6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('scrap_inv', 'item_no', new_column_name='zebra', schema='ho')
    op.alter_column('scrap_inv', 'description', new_column_name='descrizione', schema='ho')
    op.alter_column('scrap_inv', 'category', new_column_name='categoria', schema='ho')
    op.drop_index('ix_scrap_inv_item_no', table_name='scrap_inv', schema='ho')
    op.create_index('ix_scrap_inv_zebra', 'scrap_inv', ['zebra'], schema='ho')


def downgrade() -> None:
    op.drop_index('ix_scrap_inv_zebra', table_name='scrap_inv', schema='ho')
    op.create_index('ix_scrap_inv_item_no', 'scrap_inv', ['item_no'], schema='ho')
    op.alter_column('scrap_inv', 'zebra', new_column_name='item_no', schema='ho')
    op.alter_column('scrap_inv', 'descrizione', new_column_name='description', schema='ho')
    op.alter_column('scrap_inv', 'categoria', new_column_name='category', schema='ho')
