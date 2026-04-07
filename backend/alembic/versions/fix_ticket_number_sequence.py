"""Aggiunge sequenza PostgreSQL per ticket_number (fix race condition)

Revision ID: fix_ticket_seq_001
Revises: 8e5f6a7b8c9d
Create Date: 2026-04-07
"""
from alembic import op

revision = "fix_ticket_seq_001"
down_revision = "8e5f6a7b8c9d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Crea la sequenza partendo dal valore massimo attuale + 1
    op.execute("""
        DO $$
        DECLARE
            max_num INTEGER;
        BEGIN
            SELECT COALESCE(MAX(ticket_number), 0) INTO max_num FROM tickets.tickets;
            EXECUTE format('CREATE SEQUENCE IF NOT EXISTS tickets.ticket_number_seq START WITH %s', max_num + 1);
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS tickets.ticket_number_seq")
