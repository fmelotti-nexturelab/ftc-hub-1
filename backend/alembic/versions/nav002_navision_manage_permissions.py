"""navision: abilita can_manage per IT e HO

Revision ID: nav002_navision_manage_permissions
Revises: nav001_nav_credentials
Create Date: 2026-03-31
"""
import sqlalchemy as sa
from alembic import op

revision = "nav002_nav_permissions"
down_revision = "nav001_nav_credentials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IT: can_view già presente, abilita can_manage
    op.execute("""
        UPDATE ho.department_module_access
        SET can_manage = true
        WHERE module_code = 'navision' AND department = 'IT'
    """)

    # HO: inserisci con can_view + can_manage (se non esiste)
    op.execute("""
        INSERT INTO ho.department_module_access (department, module_code, can_view, can_manage)
        VALUES ('HO', 'navision', true, true)
        ON CONFLICT (department, module_code) DO UPDATE
            SET can_view = true, can_manage = true
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE ho.department_module_access
        SET can_manage = false
        WHERE module_code = 'navision' AND department = 'IT'
    """)
    op.execute("""
        UPDATE ho.department_module_access
        SET can_view = false, can_manage = false
        WHERE module_code = 'navision' AND department = 'HO'
    """)
