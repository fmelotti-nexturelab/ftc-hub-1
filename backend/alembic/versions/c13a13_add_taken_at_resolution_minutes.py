"""add taken_at and resolution_minutes to tickets

Revision ID: c13a13
Revises: d9af3e463239
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "c13a13"
down_revision = "d9af3e463239"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
        schema="tickets",
    )
    op.add_column(
        "tickets",
        sa.Column("resolution_minutes", sa.Integer(), nullable=True),
        schema="tickets",
    )


def downgrade() -> None:
    op.drop_column("tickets", "resolution_minutes", schema="tickets")
    op.drop_column("tickets", "taken_at", schema="tickets")
