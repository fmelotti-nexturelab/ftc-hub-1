"""add ho.nav_rdp_configs table

Revision ID: i001_add_nav_rdp_configs
Revises: h001_add_file_archive
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "i001_add_nav_rdp_configs"
down_revision = "h001_add_file_archive"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "nav_rdp_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("department", sa.String(50), nullable=False),
        sa.Column("nav_env", sa.String(20), nullable=False),
        sa.Column("server_host", sa.String(200), nullable=False),
        sa.Column("nav_username", sa.String(150), nullable=False),
        sa.Column("nav_password_enc", sa.Text, nullable=False),
        sa.Column("display_label", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=True),
        schema="ho",
    )
    op.create_index("ix_nav_rdp_configs_dept_env", "nav_rdp_configs", ["department", "nav_env"], schema="ho")


def downgrade():
    op.drop_index("ix_nav_rdp_configs_dept_env", table_name="nav_rdp_configs", schema="ho")
    op.drop_table("nav_rdp_configs", schema="ho")
