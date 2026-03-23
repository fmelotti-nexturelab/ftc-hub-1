"""rename user_type to department

Revision ID: d01a_rename_user_type_to_department
Revises: c13a15_add_support_error_codes
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = 'd01a_rename_user_type_to_department'
down_revision = 'c13a15_add_support_error_codes'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Rename enum type
    op.execute("ALTER TYPE auth.user_type_enum RENAME TO department_enum")

    # 2. Rename column in auth.users
    op.alter_column("users", "user_type", new_column_name="department", schema="auth")

    # 3. Rename table user_type_module_access → department_module_access
    op.execute("ALTER TABLE ho.user_type_module_access RENAME TO department_module_access")

    # 4. Rename column user_type → department in the renamed table
    op.alter_column("department_module_access", "user_type", new_column_name="department", schema="ho")

    # 5. Rename unique constraint
    op.execute("ALTER TABLE ho.department_module_access RENAME CONSTRAINT uq_usertype_module TO uq_department_module")


def downgrade():
    op.execute("ALTER TABLE ho.department_module_access RENAME CONSTRAINT uq_department_module TO uq_usertype_module")
    op.alter_column("department_module_access", "department", new_column_name="user_type", schema="ho")
    op.execute("ALTER TABLE ho.department_module_access RENAME TO user_type_module_access")
    op.alter_column("users", "department", new_column_name="user_type", schema="auth")
    op.execute("ALTER TYPE auth.department_enum RENAME TO user_type_enum")
