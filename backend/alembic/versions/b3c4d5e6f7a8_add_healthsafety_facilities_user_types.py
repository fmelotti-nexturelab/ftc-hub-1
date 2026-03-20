"""add_healthsafety_facilities_user_types

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-03-20

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auth.user_type_enum ADD VALUE IF NOT EXISTS 'HEALTHSAFETY'")
    op.execute("ALTER TYPE auth.user_type_enum ADD VALUE IF NOT EXISTS 'FACILITIES'")


def downgrade() -> None:
    pass
