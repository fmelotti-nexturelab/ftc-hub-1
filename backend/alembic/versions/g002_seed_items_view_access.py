"""seed items_view access for department_module_access

Revision ID: g002_seed_items_view_access
Revises: g001_add_item_master_it01
Create Date: 2026-03-27
"""
from alembic import op

revision = "g002_seed_items_view_access"
down_revision = "g001_add_item_master_it01"
branch_labels = None
depends_on = None

# Accessi di default per il modulo items_view (consultazione anagrafe articoli IT01).
# can_view  = può vedere la card ItemList in ConsultaDatabase e accedere alla pagina
# can_manage = può anche importare/gestire l'anagrafe (COMMERCIAL e IT)
_DEFAULT_ACCESS = [
    # department     can_view  can_manage
    ("COMMERCIAL",   True,     True),
    ("MARKETING",    True,     False),
    ("FINANCE",      True,     False),
    ("IT",           True,     True),
    ("DM",           True,     False),
]


def upgrade() -> None:
    for dept, can_view, can_manage in _DEFAULT_ACCESS:
        op.execute(f"""
            INSERT INTO ho.department_module_access
                (id, department, module_code, can_view, can_manage, updated_at)
            VALUES (
                gen_random_uuid(),
                '{dept}',
                'items_view',
                {str(can_view).lower()},
                {str(can_manage).lower()},
                now()
            )
            ON CONFLICT (department, module_code) DO NOTHING
        """)


def downgrade() -> None:
    op.execute("DELETE FROM ho.department_module_access WHERE module_code = 'items_view'")
