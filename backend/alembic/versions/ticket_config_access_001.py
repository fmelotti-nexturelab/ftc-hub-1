"""Aggiunge modulo ticket_config alla griglia Utilities

Revision ID: ticket_config_001
Revises: training_examples_001
Create Date: 2026-04-09
"""
from alembic import op

revision = "ticket_config_001"
down_revision = "training_examples_001"
branch_labels = None
depends_on = None

DEPARTMENTS = [
    "HR", "FINANCE", "MARKETING", "IT", "COMMERCIAL",
    "MANAGER", "TOPMGR", "HEALTHSAFETY", "FACILITIES", "RETAIL",
    "DM", "STORE", "STOREMANAGER",
]


def upgrade() -> None:
    # 1. Inserisci il modulo nella tabella ho.modules
    op.execute("""
        INSERT INTO ho.modules (code, name, has_view, has_manage, sort_order)
        VALUES ('ticket_config', 'Ticket Config', true, true, 160)
        ON CONFLICT (code) DO NOTHING;
    """)

    # 2. Seed tutti i department con accesso OFF di default
    values = ", ".join(
        f"(gen_random_uuid(), '{dept}', 'ticket_config', false, false, now())"
        for dept in DEPARTMENTS
    )
    op.execute(f"""
        INSERT INTO ho.department_module_access (id, department, module_code, can_view, can_manage, updated_at)
        VALUES {values}
        ON CONFLICT ON CONSTRAINT uq_department_module DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DELETE FROM ho.department_module_access WHERE module_code = 'ticket_config'")
    op.execute("DELETE FROM ho.modules WHERE code = 'ticket_config'")
