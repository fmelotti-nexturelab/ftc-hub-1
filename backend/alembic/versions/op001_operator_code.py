"""add operator_codes table

Revision ID: op001_operator_code
Revises: nav002_nav_permissions
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "op001_operator_code"
down_revision = "nav002_nav_permissions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "operator_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=True),
        schema="ho",
    )


def downgrade() -> None:
    op.drop_table("operator_codes", schema="ho")
