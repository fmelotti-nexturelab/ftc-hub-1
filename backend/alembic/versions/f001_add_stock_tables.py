"""add stock tables

Revision ID: f001_add_stock_tables
Revises: d9af3e463239
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "f001_add_stock_tables"
down_revision = "6a1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_sessions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("entity", sa.String(10), nullable=False),
        sa.Column("stock_date", sa.Date(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_stores", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploaded_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["uploaded_by"], ["auth.users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity", "stock_date", name="uq_stock_session_entity_date"),
        schema="ho",
    )

    op.create_table(
        "stock_items",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column("item_no", sa.String(50), nullable=False),
        sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("description_local", sa.String(500), nullable=False, server_default=""),
        sa.Column("adm_stock", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["session_id"], ["ho.stock_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="ho",
    )
    op.create_index("ix_stock_items_session", "stock_items", ["session_id"], schema="ho")
    op.create_index("ix_stock_items_item_no", "stock_items", ["item_no"], schema="ho")

    op.create_table(
        "stock_store_data",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("item_id", sa.BigInteger(), nullable=False),
        sa.Column("store_code", sa.String(10), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["item_id"], ["ho.stock_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="ho",
    )
    op.create_index("ix_stock_store_data_item", "stock_store_data", ["item_id"], schema="ho")
    op.create_index("ix_stock_store_data_store", "stock_store_data", ["store_code"], schema="ho")


def downgrade() -> None:
    op.drop_table("stock_store_data", schema="ho")
    op.drop_table("stock_items", schema="ho")
    op.drop_table("stock_sessions", schema="ho")
