"""Pulisce duplicati ticket_digest e aggiunge unique constraint su scheduled_jobs.name

Revision ID: scheduler_unique_001
Revises: ticket_config_001
Create Date: 2026-04-10

Il modello e la migration originale add_scheduler_001 dichiaravano `unique=True`
sulla colonna name, e in dev la constraint risulta presente, ma nel DB di
produzione la constraint non è mai finita: si sono accumulati duplicati per
`ticket_digest` (uno reale eseguito ogni giorno e uno orfano creato da un
secondo seed). Questa migration:
  1. Rimuove i duplicati tenendo, per ogni name, la riga "buona" — definita
     come quella che ha effettivamente girato (last_run_at NOT NULL); a parità
     di stato si tiene la più vecchia.
  2. Aggiunge la unique constraint solo se manca, in modo che la migration sia
     idempotente e applicabile sia in dev (dove c'è già) sia in prod (dove no).
"""
from alembic import op


revision = "scheduler_unique_001"
down_revision = "ticket_config_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Dedup: per ogni name tieni una sola riga, preferendo quelle che hanno
    #    realmente eseguito almeno una volta, poi la più vecchia.
    op.execute("""
        DELETE FROM ho.scheduled_jobs
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY name
                    ORDER BY (last_run_at IS NULL), created_at
                ) AS rn
                FROM ho.scheduled_jobs
            ) t WHERE rn > 1
        )
    """)

    # 2. Aggiungi la unique constraint solo se non è già presente.
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'scheduled_jobs_name_key'
                  AND conrelid = 'ho.scheduled_jobs'::regclass
            ) THEN
                ALTER TABLE ho.scheduled_jobs
                ADD CONSTRAINT scheduled_jobs_name_key UNIQUE (name);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE ho.scheduled_jobs
        DROP CONSTRAINT IF EXISTS scheduled_jobs_name_key;
    """)
