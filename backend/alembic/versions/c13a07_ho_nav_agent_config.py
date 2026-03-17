"""HO: add nav_agent_config table with default seed data

Revision ID: c13a07navconfig01
Revises: c13a06honav01
Create Date: 2026-03-16 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "c13a07navconfig01"
down_revision = "c13a06honav01"
branch_labels = None
depends_on = None

DEFAULT_CONFIG = [
    ("agent_url",       "http://localhost:9999",                                  "URL del NAV Agent locale"),
    ("rdp_base_path",   r"C:\Users\fmelo\OneDrive - Zebra A S\01 - NAVISION",    "Cartella base file RDP"),
    ("rdp_it01_classic","NAV IT01.rdp",                                           "File RDP NAV IT01 Classic"),
    ("rdp_it02_classic","NAV IT02.rdp",                                           "File RDP NAV IT02 Classic"),
    ("rdp_it02_new",    "NEW NAV IT02.rdp",                                       "File RDP NAV IT02 New"),
    ("rdp_it03_classic","NAV IT03.rdp",                                           "File RDP NAV IT03 Classic"),
    ("rdp_it03_new",    "NEW NAV IT03.rdp",                                       "File RDP NAV IT03 New"),
]


def upgrade() -> None:
    op.create_table(
        "nav_agent_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("config_key", sa.String(100), nullable=False, unique=True),
        sa.Column("config_value", sa.Text, nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        schema="ho",
    )

    for key, value, desc in DEFAULT_CONFIG:
        op.execute(
            sa.text(
                "INSERT INTO ho.nav_agent_config (id, config_key, config_value, description) "
                "VALUES (gen_random_uuid(), :key, :value, :desc)"
            ).bindparams(key=key, value=value, desc=desc)
        )


def downgrade() -> None:
    op.drop_table("nav_agent_config", schema="ho")
