"""add ho.nav_credentials table (department-based)

Revision ID: nav001_nav_credentials
Revises: h001_add_file_archive
Create Date: 2026-03-31
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "nav001_nav_credentials"
down_revision = "h001_add_file_archive"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nav_credentials",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("department", sa.String(50), nullable=False),
        sa.Column("nav_env", sa.String(10), nullable=False),
        sa.Column("nav_username", sa.String(100), nullable=False),
        sa.Column("nav_password_enc", sa.Text, nullable=False),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=True),
        sa.UniqueConstraint("department", "nav_env", "nav_username", name="uq_nav_cred_dept_env_user"),
        schema="ho",
    )


def downgrade() -> None:
    op.drop_table("nav_credentials", schema="ho")
