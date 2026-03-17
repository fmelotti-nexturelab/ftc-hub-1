"""add_requester_fields_to_tickets

Revision ID: 709004848eaa
Revises: c13a09ticketsv2
Create Date: 2026-03-16 21:29:53.889945

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '709004848eaa'
down_revision: Union[str, Sequence[str], None] = 'c13a09ticketsv2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tickets', sa.Column('requester_name', sa.String(255), nullable=False, server_default=''), schema='tickets')
    op.add_column('tickets', sa.Column('requester_phone', sa.String(50), nullable=False, server_default=''), schema='tickets')
    op.add_column('tickets', sa.Column('teamviewer_code', sa.String(100), nullable=False, server_default=''), schema='tickets')


def downgrade() -> None:
    op.drop_column('tickets', 'teamviewer_code', schema='tickets')
    op.drop_column('tickets', 'requester_phone', schema='tickets')
    op.drop_column('tickets', 'requester_name', schema='tickets')
