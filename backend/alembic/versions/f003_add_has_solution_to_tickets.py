"""add_has_solution_to_tickets

Revision ID: f003_add_has_solution
Revises: 819c86a2f31b
Create Date: 2026-03-26 00:00:00.000000

Aggiunge il flag has_solution alla tabella tickets.tickets.
Viene impostato a TRUE quando un manager sottomette un commento
marcato come "soluzione al problema".
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f003_add_has_solution'
down_revision: Union[str, Sequence[str], None] = '819c86a2f31b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tickets',
        sa.Column('has_solution', sa.Boolean(), nullable=False, server_default='false'),
        schema='tickets',
    )


def downgrade() -> None:
    op.drop_column('tickets', 'has_solution', schema='tickets')
