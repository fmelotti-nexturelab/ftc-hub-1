"""add_requester_email_to_tickets

Revision ID: 136a60849a7d
Revises: 9f469bfafa77
Create Date: 2026-03-19 13:14:00.052664

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '136a60849a7d'
down_revision: Union[str, Sequence[str], None] = '9f469bfafa77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("requester_email", sa.String(255), nullable=True),
        schema="tickets",
    )


def downgrade() -> None:
    op.drop_column("tickets", "requester_email", schema="tickets")
