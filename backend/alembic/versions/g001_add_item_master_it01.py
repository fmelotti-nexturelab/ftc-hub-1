"""add item_import_sessions and item_master_it01

Revision ID: g001_add_item_master_it01
Revises: f003_add_has_solution_to_tickets
Create Date: 2026-03-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "g001_add_item_master_it01"
down_revision = "f003_add_has_solution"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── item_import_sessions ────────────────────────────────────────────────
    op.create_table(
        "item_import_sessions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("entity", sa.String(10), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("imported_by", UUID(as_uuid=True), nullable=True),
        sa.Column("batch_id", sa.String(8), nullable=False),
        sa.Column("row_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("source_filename", sa.String(255), nullable=True),
        sa.Column("is_current", sa.Boolean(), server_default="false", nullable=False),
        sa.ForeignKeyConstraint(["imported_by"], ["auth.users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema="ho",
    )
    op.create_index(
        "ix_item_import_sessions_entity_current",
        "item_import_sessions",
        ["entity", "is_current"],
        schema="ho",
    )

    # ── item_master_it01 ────────────────────────────────────────────────────
    op.create_table(
        "item_master_it01",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column("item_no", sa.String(50), nullable=False),
        sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("description_local", sa.String(500), nullable=False, server_default=""),
        sa.Column("warehouse", sa.String(50), nullable=True),
        sa.Column("last_cost", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("item_cat", sa.String(100), nullable=True),
        sa.Column("net_weight", sa.Numeric(10, 4), nullable=True),
        sa.Column("barcode", sa.BigInteger(), nullable=True),
        sa.Column("vat_code", sa.String(50), nullable=True),
        sa.Column("units_per_pack", sa.Integer(), nullable=True),
        sa.Column("model_store", sa.String(100), nullable=True),
        sa.Column("batteries", sa.String(100), nullable=True),
        sa.Column("first_rp", sa.String(100), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("barcode_ext", sa.BigInteger(), nullable=True),
        sa.Column("vat_pct", sa.Numeric(8, 4), nullable=True),
        sa.Column("gm_pct", sa.Numeric(8, 4), nullable=True),
        sa.Column("description1", sa.String(500), nullable=True),
        sa.Column("description2", sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"], ["ho.item_import_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="ho",
    )
    op.create_index("ix_item_master_it01_session", "item_master_it01", ["session_id"], schema="ho")
    op.create_index("ix_item_master_it01_item_no", "item_master_it01", ["item_no"], schema="ho")
    op.create_index("ix_item_master_it01_barcode", "item_master_it01", ["barcode"], schema="ho")

    # ── Permessi ────────────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO auth.permissions (id, code, name, description, module, is_active)
        SELECT gen_random_uuid(), v.code, v.name, v.description, 'items', true
        FROM (VALUES
          ('items.view',   'Visualizza anagrafe articoli',   'Accesso in lettura all''anagrafe articoli'),
          ('items.import', 'Importa anagrafe articoli',      'Carica nuovi dati dal converter'),
          ('items.export', 'Esporta anagrafe articoli',      'Scarica file per il portale')
        ) AS v(code, name, description)
        WHERE NOT EXISTS (
          SELECT 1 FROM auth.permissions p WHERE p.code = v.code
        )
    """)


def downgrade() -> None:
    op.execute("DELETE FROM auth.permissions WHERE name IN ('items.view', 'items.import', 'items.export')")
    op.drop_table("item_master_it01", schema="ho")
    op.drop_table("item_import_sessions", schema="ho")
