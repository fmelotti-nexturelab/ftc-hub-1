"""add evaded fields to operator_code_requests

Revision ID: oc002_add_evaded_fields
Revises: oc001_add_operator_code_requests
Create Date: 2026-04-22

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'oc002_add_evaded_fields'
down_revision: Union[str, Sequence[str], None] = 'oc001_add_operator_code_requests'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('operator_code_requests',
        sa.Column('is_evaded', sa.Boolean(), nullable=False, server_default='false'),
        schema='ho')
    op.add_column('operator_code_requests',
        sa.Column('evaded_at', sa.DateTime(timezone=True), nullable=True),
        schema='ho')


def downgrade() -> None:
    op.drop_column('operator_code_requests', 'evaded_at', schema='ho')
    op.drop_column('operator_code_requests', 'is_evaded', schema='ho')
