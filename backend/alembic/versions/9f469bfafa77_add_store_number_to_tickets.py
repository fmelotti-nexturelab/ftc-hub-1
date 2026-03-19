"""add_store_number_to_tickets

Revision ID: 9f469bfafa77
Revises: 18cc564d65c4
Create Date: 2026-03-19 11:54:45.681991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f469bfafa77"
down_revision: Union[str, None] = "18cc564d65c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Aggiunge store_number a tickets.tickets
    op.add_column(
        "tickets",
        sa.Column("store_number", sa.String(20), nullable=True),
        schema="tickets",
    )

    # Aggiunge STOREMANAGER a ho.user_type_module_access per il modulo tickets
    op.execute("""
        INSERT INTO ho.user_type_module_access (user_type, module_code, can_view, can_manage)
        VALUES ('STOREMANAGER', 'tickets', true, false)
        ON CONFLICT (user_type, module_code) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM ho.user_type_module_access
        WHERE user_type = 'STOREMANAGER' AND module_code = 'tickets'
    """)
    op.drop_column("tickets", "store_number", schema="tickets")
