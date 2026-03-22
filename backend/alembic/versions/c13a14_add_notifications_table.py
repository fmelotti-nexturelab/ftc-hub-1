"""add notifications table

Revision ID: c13a14
Revises: c13a13
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "c13a14"
down_revision = "c13a13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("ticket_id", UUID(as_uuid=True), sa.ForeignKey("tickets.tickets.id"), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="tickets",
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"], schema="tickets")
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"], schema="tickets")


def downgrade() -> None:
    op.drop_index("ix_notifications_is_read", table_name="notifications", schema="tickets")
    op.drop_index("ix_notifications_user_id", table_name="notifications", schema="tickets")
    op.drop_table("notifications", schema="tickets")
