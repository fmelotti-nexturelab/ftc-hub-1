"""add gateway/remoteapp fields to ho.nav_rdp_configs

Revision ID: i002_add_nav_rdp_gateway_fields
Revises: i001_add_nav_rdp_configs
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = "i002_add_nav_rdp_gateway_fields"
down_revision = "i001_add_nav_rdp_configs"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("nav_rdp_configs", sa.Column("gateway_host",   sa.String(200), nullable=True), schema="ho")
    op.add_column("nav_rdp_configs", sa.Column("rdp_app_name",   sa.String(100), nullable=True), schema="ho")
    op.add_column("nav_rdp_configs", sa.Column("rdp_app_cmdline", sa.Text,        nullable=True), schema="ho")


def downgrade():
    op.drop_column("nav_rdp_configs", "rdp_app_cmdline", schema="ho")
    op.drop_column("nav_rdp_configs", "rdp_app_name",    schema="ho")
    op.drop_column("nav_rdp_configs", "gateway_host",    schema="ho")
