"""add exported_at to operator_code_requests

Revision ID: oc005_add_exported_at
Revises: oc004_add_assigned_fields
Create Date: 2026-04-22

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'oc005_add_exported_at'
down_revision: Union[str, Sequence[str], None] = 'oc004_add_assigned_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('operator_code_requests',
        sa.Column('exported_at', sa.DateTime(timezone=True), nullable=True),
        schema='ho')


def downgrade() -> None:
    op.drop_column('operator_code_requests', 'exported_at', schema='ho')
