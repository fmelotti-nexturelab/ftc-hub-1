"""rename scrap_wd columns: item_no->zebra, description->descrizione, category->categoria

Revision ID: 7d4e5f6a7b8c
Revises: 6c3d4e5f6a7b
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op


revision: str = '7d4e5f6a7b8c'
down_revision: str = '6c3d4e5f6a7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('scrap_wd', 'item_no', new_column_name='zebra', schema='ho')
    op.alter_column('scrap_wd', 'description', new_column_name='descrizione', schema='ho')
    op.alter_column('scrap_wd', 'category', new_column_name='categoria', schema='ho')
    op.drop_index('ix_scrap_wd_item_no', table_name='scrap_wd', schema='ho')
    op.create_index('ix_scrap_wd_zebra', 'scrap_wd', ['zebra'], schema='ho')


def downgrade() -> None:
    op.drop_index('ix_scrap_wd_zebra', table_name='scrap_wd', schema='ho')
    op.create_index('ix_scrap_wd_item_no', 'scrap_wd', ['item_no'], schema='ho')
    op.alter_column('scrap_wd', 'zebra', new_column_name='item_no', schema='ho')
    op.alter_column('scrap_wd', 'descrizione', new_column_name='description', schema='ho')
    op.alter_column('scrap_wd', 'categoria', new_column_name='category', schema='ho')
