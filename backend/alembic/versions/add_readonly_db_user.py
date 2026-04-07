"""Crea utente PostgreSQL read-only per le query AI analyst

Revision ID: add_readonly_user
Revises: add_scheduler_001
Create Date: 2026-04-08
"""
from alembic import op

revision = "add_readonly_user"
down_revision = "add_scheduler_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ftc_reader') THEN
                CREATE ROLE ftc_reader LOGIN PASSWORD 'ftc_reader_readonly_2026';
            END IF;
        END $$;
    """)
    op.execute("GRANT CONNECT ON DATABASE ftc_hub TO ftc_reader")
    op.execute("GRANT USAGE ON SCHEMA tickets TO ftc_reader")
    op.execute("GRANT SELECT ON ALL TABLES IN SCHEMA tickets TO ftc_reader")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA tickets GRANT SELECT ON TABLES TO ftc_reader")
    # Accesso anche a ho.stores per contesto negozi
    op.execute("GRANT USAGE ON SCHEMA ho TO ftc_reader")
    op.execute("GRANT SELECT ON ho.stores TO ftc_reader")


def downgrade() -> None:
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA tickets FROM ftc_reader")
    op.execute("REVOKE ALL ON SCHEMA tickets FROM ftc_reader")
    op.execute("REVOKE ALL ON ho.stores FROM ftc_reader")
    op.execute("REVOKE ALL ON SCHEMA ho FROM ftc_reader")
    op.execute("REVOKE CONNECT ON DATABASE ftc_hub FROM ftc_reader")
    op.execute("DROP ROLE IF EXISTS ftc_reader")
