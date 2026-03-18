"""add_retail_user_type

Revision ID: a1b2c3d4e5f6
Revises: 8c2b63197127
Create Date: 2026-03-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '8c2b63197127'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auth.user_type_enum ADD VALUE IF NOT EXISTS 'RETAIL'")


def downgrade() -> None:
    pass
