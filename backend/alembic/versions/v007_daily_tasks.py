"""daily_tasks: tabelle attività giornaliere e log completamenti

Revision ID: v007_daily_tasks
Revises: v006_fix_sales_l2w_view
Create Date: 2026-04-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "v007_daily_tasks"
down_revision = "v006_fix_sales_l2w_view"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE ho.daily_tasks (
            id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            code         VARCHAR(50)  NOT NULL UNIQUE,
            name         VARCHAR(200) NOT NULL,
            instructions TEXT,
            frequency    VARCHAR(20)  NOT NULL DEFAULT 'daily',
            sort_order   INTEGER      NOT NULL DEFAULT 0,
            is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE ho.daily_task_logs (
            id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id  UUID        NOT NULL REFERENCES ho.daily_tasks(id) ON DELETE CASCADE,
            done_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            done_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
            notes    VARCHAR(500)
        )
    """)

    op.execute("CREATE INDEX ix_daily_task_logs_task_id ON ho.daily_task_logs (task_id)")
    op.execute("CREATE INDEX ix_daily_task_logs_done_at ON ho.daily_task_logs (done_at)")

    # Seed attività iniziali
    op.execute("""
        INSERT INTO ho.daily_tasks (code, name, instructions, frequency, sort_order)
        VALUES (
            'sales_l2w_sync',
            'Sincronizzazione Sales L2W',
            '1. Apri un Prompt dei comandi
2. Vai nella cartella: cd C:\Projects\FTC_HUB\nav_agent
3. Esegui: python sales_sync.py
4. Attendi il completamento (circa 30 secondi)
5. Verifica che l''output mostri "Completato." senza errori
6. Controlla in AllData che la colonna SALES sia aggiornata

NOTA LUNEDÌ: aggiorna automaticamente i filtri alle ultime 3 settimane.
Assicurati che il file OneDrive sia sincronizzato prima di procedere.',
            'daily',
            10
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ho.daily_task_logs")
    op.execute("DROP TABLE IF EXISTS ho.daily_tasks")
