"""add full_name to operator_code_pool

Revision ID: oc006_add_full_name_to_pool
Revises: 7d2e2318ed12
Create Date: 2026-04-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'oc006_add_full_name_to_pool'
down_revision: Union[str, Sequence[str], None] = '7d2e2318ed12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'operator_code_pool',
        sa.Column('full_name', sa.String(200), nullable=True),
        schema='ho',
    )


def downgrade() -> None:
    op.drop_column('operator_code_pool', 'full_name', schema='ho')
