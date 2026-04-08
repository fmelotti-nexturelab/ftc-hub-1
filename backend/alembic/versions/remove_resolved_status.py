"""Converte tutti i ticket con status 'resolved' in 'closed'

Revision ID: remove_resolved_001
Revises: add_readonly_user
Create Date: 2026-04-08
"""
from alembic import op

revision = "remove_resolved_001"
down_revision = "add_readonly_user"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE tickets.tickets
        SET status = 'closed', closed_at = COALESCE(closed_at, updated_at, NOW())
        WHERE status = 'resolved'
    """)


def downgrade() -> None:
    pass  # non reversibile — resolved non viene più usato
