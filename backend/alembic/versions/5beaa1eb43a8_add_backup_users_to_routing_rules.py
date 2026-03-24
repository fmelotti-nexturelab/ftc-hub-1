"""add_backup_users_to_routing_rules

Revision ID: 5beaa1eb43a8
Revises: d02a
Create Date: 2026-03-23 21:36:29.252163

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '5beaa1eb43a8'
down_revision: Union[str, Sequence[str], None] = 'd02a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'ticket_routing_rules',
        sa.Column('backup_user_id_1', postgresql.UUID(as_uuid=True), sa.ForeignKey('auth.users.id'), nullable=True),
        schema='tickets',
    )
    op.add_column(
        'ticket_routing_rules',
        sa.Column('backup_user_id_2', postgresql.UUID(as_uuid=True), sa.ForeignKey('auth.users.id'), nullable=True),
        schema='tickets',
    )


def downgrade() -> None:
    op.drop_column('ticket_routing_rules', 'backup_user_id_2', schema='tickets')
    op.drop_column('ticket_routing_rules', 'backup_user_id_1', schema='tickets')
