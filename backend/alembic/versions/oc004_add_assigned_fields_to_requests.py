"""add assigned_code and assigned_password to operator_code_requests

Revision ID: oc004_add_assigned_fields
Revises: oc003_add_operator_code_pool
Create Date: 2026-04-22

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'oc004_add_assigned_fields'
down_revision: Union[str, Sequence[str], None] = 'oc003_add_operator_code_pool'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('operator_code_requests',
        sa.Column('assigned_code', sa.Integer(), nullable=True),
        schema='ho')
    op.add_column('operator_code_requests',
        sa.Column('assigned_password', sa.String(10), nullable=True),
        schema='ho')
    op.add_column('operator_code_requests',
        sa.Column('assigned_email', sa.String(200), nullable=True),
        schema='ho')


def downgrade() -> None:
    op.drop_column('operator_code_requests', 'assigned_email', schema='ho')
    op.drop_column('operator_code_requests', 'assigned_password', schema='ho')
    op.drop_column('operator_code_requests', 'assigned_code', schema='ho')
