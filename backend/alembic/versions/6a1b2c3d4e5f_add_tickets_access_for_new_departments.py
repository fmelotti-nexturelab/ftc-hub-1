"""add_tickets_access_for_new_departments

Revision ID: 6a1b2c3d4e5f
Revises: 5beaa1eb43a8
Create Date: 2026-03-23 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = '6a1b2c3d4e5f'
down_revision: Union[str, Sequence[str], None] = '5beaa1eb43a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Aggiunge accesso al modulo tickets per i department aggiunti dopo la migration iniziale:
    # FACILITIES, HEALTHSAFETY, MANAGER, TOPMGR, RETAIL
    # can_manage=True permette di vedere e gestire i ticket del proprio team
    op.execute("""
        INSERT INTO ho.department_module_access (department, module_code, can_view, can_manage)
        VALUES
            ('FACILITIES',   'tickets', true, true),
            ('HEALTHSAFETY', 'tickets', true, true),
            ('MANAGER',      'tickets', true, true),
            ('TOPMGR',       'tickets', true, true),
            ('RETAIL',       'tickets', true, true)
        ON CONFLICT (department, module_code) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM ho.department_module_access
        WHERE department IN ('FACILITIES', 'HEALTHSAFETY', 'MANAGER', 'TOPMGR', 'RETAIL')
          AND module_code = 'tickets';
    """)
