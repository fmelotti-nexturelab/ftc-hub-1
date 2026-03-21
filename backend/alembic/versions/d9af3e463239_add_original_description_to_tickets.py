"""add_original_description_to_tickets

Revision ID: d9af3e463239
Revises: b3c4d5e6f7a8
Create Date: 2026-03-21 10:33:23.824306

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9af3e463239'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tickets',
        sa.Column('original_description', sa.Text(), nullable=True),
        schema='tickets',
    )


def downgrade() -> None:
    op.drop_column('tickets', 'original_description', schema='tickets')
