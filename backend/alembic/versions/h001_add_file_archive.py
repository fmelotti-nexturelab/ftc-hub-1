"""add ho.file_archive table

Revision ID: h001_add_file_archive
Revises: g002_seed_items_view_access
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "h001_add_file_archive"
down_revision = "g002_seed_items_view_access"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "file_archive",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("entity", sa.String(10), nullable=False),
        sa.Column("file_date", sa.Date, nullable=False),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=True),
        sa.UniqueConstraint("file_type", "entity", "file_date", name="uq_file_archive_type_entity_date"),
        schema="ho",
    )


def downgrade():
    op.drop_table("file_archive", schema="ho")
