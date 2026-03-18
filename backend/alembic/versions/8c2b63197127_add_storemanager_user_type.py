"""add_storemanager_user_type

Revision ID: 8c2b63197127
Revises: c13a11modules01
Create Date: 2026-03-18 11:26:48.488933

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c2b63197127'
down_revision: Union[str, Sequence[str], None] = 'c13a11modules01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auth.user_type_enum ADD VALUE IF NOT EXISTS 'STOREMANAGER'")


def downgrade() -> None:
    pass
