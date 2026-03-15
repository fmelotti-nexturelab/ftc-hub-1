"""add rbac scope tables

Revision ID: c13a01rbac01
Revises: b69996e08f2f
Create Date: 2026-03-13 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c13a01rbac01"
down_revision = "b69996e08f2f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # auth.scopes
    # -------------------------------------------------------------------------
    op.create_table(
        "scopes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scope_type", sa.String(length=20), nullable=False),
        sa.Column("scope_code", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("entity_code", sa.String(length=20), nullable=True),
        sa.Column("store_code", sa.String(length=20), nullable=True),
        sa.Column("module_code", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "scope_type in ('GLOBAL', 'ENTITY', 'STORE', 'MODULE')",
            name="ck_scopes_type",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scope_type", "scope_code", name="uq_scopes_type_code"),
        schema="auth",
    )

    op.create_index("ix_scopes_type", "scopes", ["scope_type"], unique=False, schema="auth")
    op.create_index("ix_scopes_entity_code", "scopes", ["entity_code"], unique=False, schema="auth")
    op.create_index("ix_scopes_store_code", "scopes", ["store_code"], unique=False, schema="auth")

    # -------------------------------------------------------------------------
    # auth.role_permission_scopes
    # -------------------------------------------------------------------------
    op.create_table(
        "role_permission_scopes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scope_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["permission_id"], ["auth.permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["auth.roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scope_id"], ["auth.scopes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role_id", "permission_id", "scope_id", name="uq_role_permission_scope"),
        schema="auth",
    )

    op.create_index("ix_rps_role", "role_permission_scopes", ["role_id"], unique=False, schema="auth")
    op.create_index("ix_rps_permission", "role_permission_scopes", ["permission_id"], unique=False, schema="auth")
    op.create_index("ix_rps_scope", "role_permission_scopes", ["scope_id"], unique=False, schema="auth")

    # -------------------------------------------------------------------------
    # auth.user_permission_scopes
    # -------------------------------------------------------------------------
    op.create_table(
        "user_permission_scopes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scope_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("effect", sa.String(length=10), nullable=False, server_default="allow"),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint(
            "effect in ('allow', 'deny')",
            name="ck_user_permission_scopes_effect",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["auth.users.id"]),
        sa.ForeignKeyConstraint(["permission_id"], ["auth.permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scope_id"], ["auth.scopes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="auth",
    )

    op.create_index("ix_ups_user", "user_permission_scopes", ["user_id"], unique=False, schema="auth")
    op.create_index("ix_ups_permission", "user_permission_scopes", ["permission_id"], unique=False, schema="auth")
    op.create_index("ix_ups_scope", "user_permission_scopes", ["scope_id"], unique=False, schema="auth")
    op.create_index(
        "ix_ups_validity",
        "user_permission_scopes",
        ["valid_from", "valid_to"],
        unique=False,
        schema="auth",
    )

    # -------------------------------------------------------------------------
    # auth.user_assignments
    # -------------------------------------------------------------------------
    op.create_table(
        "user_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_code", sa.String(length=20), nullable=True),
        sa.Column("store_code", sa.String(length=20), nullable=True),
        sa.Column("assignment_type", sa.String(length=20), nullable=False, server_default="PRIMARY"),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint(
            "assignment_type in ('PRIMARY', 'SECONDARY', 'TEMP')",
            name="ck_user_assignments_type",
        ),
        sa.CheckConstraint(
            "entity_code is not null or store_code is not null",
            name="ck_user_assignments_entity_or_store",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["auth.users.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="auth",
    )

    op.create_index("ix_assignments_user", "user_assignments", ["user_id"], unique=False, schema="auth")
    op.create_index("ix_assignments_entity", "user_assignments", ["entity_code"], unique=False, schema="auth")
    op.create_index("ix_assignments_store", "user_assignments", ["store_code"], unique=False, schema="auth")

    # -------------------------------------------------------------------------
    # Seed minimo scopes
    # -------------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO auth.scopes (
            id, scope_type, scope_code, description, entity_code, store_code, module_code, is_active
        )
        VALUES
            (gen_random_uuid(), 'GLOBAL', 'GLOBAL', 'Intero sistema', NULL, NULL, NULL, true),
            (gen_random_uuid(), 'ENTITY', 'IT01', 'Entity IT01', 'IT01', NULL, NULL, true),
            (gen_random_uuid(), 'ENTITY', 'IT02', 'Entity IT02', 'IT02', NULL, NULL, true),
            (gen_random_uuid(), 'ENTITY', 'IT03', 'Entity IT03', 'IT03', NULL, NULL, true)
        ON CONFLICT (scope_type, scope_code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_assignments_store", table_name="user_assignments", schema="auth")
    op.drop_index("ix_assignments_entity", table_name="user_assignments", schema="auth")
    op.drop_index("ix_assignments_user", table_name="user_assignments", schema="auth")
    op.drop_table("user_assignments", schema="auth")

    op.drop_index("ix_ups_validity", table_name="user_permission_scopes", schema="auth")
    op.drop_index("ix_ups_scope", table_name="user_permission_scopes", schema="auth")
    op.drop_index("ix_ups_permission", table_name="user_permission_scopes", schema="auth")
    op.drop_index("ix_ups_user", table_name="user_permission_scopes", schema="auth")
    op.drop_table("user_permission_scopes", schema="auth")

    op.drop_index("ix_rps_scope", table_name="role_permission_scopes", schema="auth")
    op.drop_index("ix_rps_permission", table_name="role_permission_scopes", schema="auth")
    op.drop_index("ix_rps_role", table_name="role_permission_scopes", schema="auth")
    op.drop_table("role_permission_scopes", schema="auth")

    op.drop_index("ix_scopes_store_code", table_name="scopes", schema="auth")
    op.drop_index("ix_scopes_entity_code", table_name="scopes", schema="auth")
    op.drop_index("ix_scopes_type", table_name="scopes", schema="auth")
    op.drop_table("scopes", schema="auth")