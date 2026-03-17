"""Tickets: schema, tabelle, permessi e seed RBAC

Revision ID: c13a08tickets01
Revises: c13a07navconfig01
Create Date: 2026-03-16 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "c13a08tickets01"
down_revision = "c13a07navconfig01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Schema ────────────────────────────────────────────────────────────────
    op.execute("CREATE SCHEMA IF NOT EXISTS tickets")

    # ── Enum types ────────────────────────────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE tickets.ticketcategory AS ENUM
                ('hardware','software','network','nav_erp','access','other');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE tickets.ticketpriority AS ENUM
                ('low','medium','high','critical');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE tickets.ticketstatus AS ENUM
                ('open','in_progress','waiting','resolved','closed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)

    # ── Tabella tickets.tickets ───────────────────────────────────────────────
    op.create_table(
        "tickets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ticket_number", sa.Integer, nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("category", sa.Text, nullable=False),
        sa.Column("priority", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="open"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=False),
        sa.Column("assigned_to", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        schema="tickets",
    )

    # ── Tabella tickets.ticket_comments ───────────────────────────────────────
    op.create_table(
        "ticket_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ticket_id", UUID(as_uuid=True), sa.ForeignKey("tickets.tickets.id"), nullable=False),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_internal", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        schema="tickets",
    )

    # ── Tabella tickets.ticket_attachments ────────────────────────────────────
    op.create_table(
        "ticket_attachments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ticket_id", UUID(as_uuid=True), sa.ForeignKey("tickets.tickets.id"), nullable=True),
        sa.Column("comment_id", UUID(as_uuid=True), sa.ForeignKey("tickets.ticket_comments.id"), nullable=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        schema="tickets",
    )

    # ── Permessi ──────────────────────────────────────────────────────────────
    op.execute(
        """
        INSERT INTO auth.permissions (id, code, name, description, module, is_active)
        SELECT gen_random_uuid(), x.code, x.name, x.description, 'tickets', true
        FROM (VALUES
            ('tickets.create',  'Tickets Create',  'Aprire un ticket'),
            ('tickets.view',    'Tickets View',    'Vedere i propri ticket'),
            ('tickets.manage',  'Tickets Manage',  'Gestire tutti i ticket')
        ) AS x(code, name, description)
        WHERE NOT EXISTS (
            SELECT 1 FROM auth.permissions p WHERE p.code = x.code
        )
        """
    )

    # ── Ruolo IT (se non esiste) ──────────────────────────────────────────────
    op.execute(
        """
        INSERT INTO auth.roles (id, code, name, is_active)
        SELECT gen_random_uuid(), 'IT', 'IT Support', true
        WHERE NOT EXISTS (SELECT 1 FROM auth.roles WHERE code = 'IT')
        """
    )

    # ── Assegna tickets.create e tickets.view a TUTTI i ruoli ─────────────────
    op.execute(
        """
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p ON p.code IN ('tickets.create', 'tickets.view')
        WHERE NOT EXISTS (
            SELECT 1 FROM auth.role_permissions rp
            WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
        """
    )

    # ── Assegna tickets.manage a ADMIN e IT ───────────────────────────────────
    op.execute(
        """
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p ON p.code = 'tickets.manage'
        WHERE r.code IN ('ADMIN', 'IT')
          AND NOT EXISTS (
              SELECT 1 FROM auth.role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )

    # ── Scope GLOBAL per tickets.create e tickets.view → tutti i ruoli ────────
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p ON p.code IN ('tickets.create', 'tickets.view')
        JOIN auth.role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
        JOIN auth.scopes s ON s.scope_type = 'GLOBAL' AND s.scope_code = 'GLOBAL'
        WHERE NOT EXISTS (
            SELECT 1 FROM auth.role_permission_scopes rps
            WHERE rps.role_id = r.id AND rps.permission_id = p.id AND rps.scope_id = s.id
        )
        """
    )

    # ── Scope GLOBAL per tickets.manage → ADMIN e IT ──────────────────────────
    op.execute(
        """
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p ON p.code = 'tickets.manage'
        JOIN auth.role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
        JOIN auth.scopes s ON s.scope_type = 'GLOBAL' AND s.scope_code = 'GLOBAL'
        WHERE r.code IN ('ADMIN', 'IT')
          AND NOT EXISTS (
              SELECT 1 FROM auth.role_permission_scopes rps
              WHERE rps.role_id = r.id AND rps.permission_id = p.id AND rps.scope_id = s.id
          )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM auth.role_permission_scopes
        WHERE permission_id IN (
            SELECT id FROM auth.permissions WHERE code IN ('tickets.create','tickets.view','tickets.manage')
        )
        """
    )
    op.execute(
        """
        DELETE FROM auth.role_permissions
        WHERE permission_id IN (
            SELECT id FROM auth.permissions WHERE code IN ('tickets.create','tickets.view','tickets.manage')
        )
        """
    )
    op.execute("DELETE FROM auth.permissions WHERE code IN ('tickets.create','tickets.view','tickets.manage')")
    op.execute("DELETE FROM auth.roles WHERE code = 'IT'")
    op.drop_table("ticket_attachments", schema="tickets")
    op.drop_table("ticket_comments", schema="tickets")
    op.drop_table("tickets", schema="tickets")
    op.execute("DROP TYPE IF EXISTS tickets.ticketstatus")
    op.execute("DROP TYPE IF EXISTS tickets.ticketpriority")
    op.execute("DROP TYPE IF EXISTS tickets.ticketcategory")
    op.execute("DROP SCHEMA IF EXISTS tickets")
