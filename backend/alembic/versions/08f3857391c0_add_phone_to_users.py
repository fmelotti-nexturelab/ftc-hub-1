"""add_phone_to_users

Revision ID: 08f3857391c0
Revises: 136a60849a7d
Create Date: 2026-03-19 17:49:05.826980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08f3857391c0'
down_revision: Union[str, Sequence[str], None] = '136a60849a7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(50), nullable=True), schema='auth')


def downgrade() -> None:
    op.drop_column('users', 'phone', schema='auth')
