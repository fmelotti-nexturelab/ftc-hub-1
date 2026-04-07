"""add stampa_etichette module to access grid

Revision ID: 8e5f6a7b8c9d
Revises: 7d4e5f6a7b8c
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op


revision: str = '8e5f6a7b8c9d'
down_revision: str = '7d4e5f6a7b8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEPARTMENTS = [
    "HR", "FINANCE", "MARKETING", "IT", "COMMERCIAL",
    "MANAGER", "TOPMGR", "HEALTHSAFETY", "FACILITIES", "RETAIL",
    "DM", "STORE", "STOREMANAGER",
]


def upgrade() -> None:
    # 1. Inserisci il modulo
    op.execute("""
        INSERT INTO ho.modules (code, name, has_view, has_manage, sort_order)
        VALUES ('stampa_etichette', 'Stampa Etichette', true, true, 155)
        ON CONFLICT (code) DO NOTHING;
    """)

    # 2. Seed accessi di default: tutto OFF per ora (l'admin abiliterà dalla griglia)
    values = ", ".join(
        f"('{dept}', 'stampa_etichette', false, false)"
        for dept in DEPARTMENTS
    )
    op.execute(f"""
        INSERT INTO ho.department_module_access (department, module_code, can_view, can_manage)
        VALUES {values}
        ON CONFLICT ON CONSTRAINT uq_department_module DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DELETE FROM ho.department_module_access WHERE module_code = 'stampa_etichette';")
    op.execute("DELETE FROM ho.modules WHERE code = 'stampa_etichette';")
