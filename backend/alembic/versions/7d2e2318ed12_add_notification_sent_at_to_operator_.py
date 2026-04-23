"""add_notification_sent_at_to_operator_code_requests

Revision ID: 7d2e2318ed12
Revises: oc005_add_exported_at
Create Date: 2026-04-23 11:59:16.161954

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '7d2e2318ed12'
down_revision: Union[str, Sequence[str], None] = 'oc005_add_exported_at'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'operator_code_requests',
        sa.Column('notification_sent_at', sa.DateTime(timezone=True), nullable=True),
        schema='ho',
    )


def downgrade() -> None:
    op.drop_column('operator_code_requests', 'notification_sent_at', schema='ho')
