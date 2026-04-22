"""add operator_code_requests table

Revision ID: oc001_add_operator_code_requests
Revises: 6f156c25f92a
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'oc001_add_operator_code_requests'
down_revision: Union[str, Sequence[str], None] = '6f156c25f92a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'operator_code_requests',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('store_number', sa.String(20), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('requested_by', sa.UUID(as_uuid=True), sa.ForeignKey('auth.users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema='ho',
    )


def downgrade() -> None:
    op.drop_table('operator_code_requests', schema='ho')
