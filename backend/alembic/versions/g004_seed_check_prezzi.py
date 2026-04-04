"""seed check_prezzi access for department_module_access

Revision ID: g004_seed_check_prezzi
Revises: g003_item_extra_cols
Create Date: 2026-04-03
"""
from alembic import op

revision = "g004_seed_check_prezzi"
down_revision = "g003_item_extra_cols"
branch_labels = None
depends_on = None

_DEFAULT_ACCESS = [
    # department     can_view  can_manage
    ("ADMIN",        True,     True),
    ("SUPERUSER",    True,     True),
    ("COMMERCIAL",   True,     True),
    ("IT",           True,     True),
]


def upgrade() -> None:
    for dept, can_view, can_manage in _DEFAULT_ACCESS:
        op.execute(f"""
            INSERT INTO ho.department_module_access
                (id, department, module_code, can_view, can_manage, updated_at)
            VALUES (
                gen_random_uuid(),
                '{dept}',
                'check_prezzi',
                {str(can_view).lower()},
                {str(can_manage).lower()},
                now()
            )
            ON CONFLICT (department, module_code) DO NOTHING
        """)


def downgrade() -> None:
    op.execute("DELETE FROM ho.department_module_access WHERE module_code = 'check_prezzi'")
