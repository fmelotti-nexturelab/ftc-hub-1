"""add_stores_table

Revision ID: d70fde3370d5
Revises: 8c2b63197127
Create Date: 2026-03-18 20:47:13.163221

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd70fde3370d5'
down_revision: Union[str, Sequence[str], None] = '8c2b63197127'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'stores',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('store_number', sa.String(20), nullable=False, unique=True),
        sa.Column('store_name', sa.String(200), nullable=False),
        sa.Column('entity', sa.String(10), nullable=False),
        sa.Column('district', sa.String(100), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('location_type', sa.String(50), nullable=True),
        sa.Column('opening_date', sa.Date, nullable=True),
        sa.Column('address', sa.String(300), nullable=True),
        sa.Column('postal_code', sa.String(10), nullable=True),
        sa.Column('full_address', sa.String(500), nullable=True),
        sa.Column('nav_code', sa.String(20), nullable=True),
        sa.Column('phone', sa.String(30), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('dm_name', sa.String(200), nullable=True),
        sa.Column('sm_name', sa.String(200), nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        schema='ho',
    )
    op.create_index('ix_ho_stores_store_number', 'stores', ['store_number'], schema='ho')
    op.create_index('ix_ho_stores_entity', 'stores', ['entity'], schema='ho')


def downgrade() -> None:
    op.drop_index('ix_ho_stores_entity', table_name='stores', schema='ho')
    op.drop_index('ix_ho_stores_store_number', table_name='stores', schema='ho')
    op.drop_table('stores', schema='ho')
