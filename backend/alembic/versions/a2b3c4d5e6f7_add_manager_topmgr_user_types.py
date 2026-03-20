"""add_manager_topmgr_user_types

Revision ID: a2b3c4d5e6f7
Revises: 08f3857391c0
Create Date: 2026-03-20

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = '08f3857391c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auth.user_type_enum ADD VALUE IF NOT EXISTS 'MANAGER'")
    op.execute("ALTER TYPE auth.user_type_enum ADD VALUE IF NOT EXISTS 'TOPMGR'")


def downgrade() -> None:
    # PostgreSQL non supporta la rimozione di valori da un enum
    pass
