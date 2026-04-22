"""add mobile integration tables (pairing + devices + scanner sessions)

Revision ID: mob001_mobile_integration
Revises: scheduler_unique_001
Create Date: 2026-04-11

Crea lo schema `mobile` e le 4 tabelle base per l'integrazione con l'app Android
Zebra (vedi memory project_android_integration.md — Fase 1):

  mobile.pairing_tokens      — token short-lived per il pairing Code128 iniziale
  mobile.devices             — palmari paired, con device_token long-lived
  mobile.scanner_sessions    — sessioni di scansione upload-ate dal palmare
  mobile.scanner_session_items — singoli codici scansionati in una sessione
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "mob001_mobile_integration"
down_revision = "scheduler_unique_001"
branch_labels = None
depends_on = None


def upgrade():
    # Schema dedicato per tutto il dominio mobile (palmari Zebra, future integrazioni)
    op.execute("CREATE SCHEMA IF NOT EXISTS mobile")

    # ── mobile.pairing_tokens ────────────────────────────────────────────────
    # Token one-shot generato dal PC in FTC HUB e mostrato come Code128 al
    # palmare. Vita breve (minuti), consumato al primo uso.
    op.create_table(
        "pairing_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("store_code", sa.String(20), nullable=False),
        sa.Column(
            "created_by_user",
            UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "used_by_device",
            UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        schema="mobile",
    )
    op.create_index(
        "ix_mobile_pairing_tokens_token",
        "pairing_tokens",
        ["token"],
        unique=True,
        schema="mobile",
    )
    op.create_index(
        "ix_mobile_pairing_tokens_store_code",
        "pairing_tokens",
        ["store_code"],
        schema="mobile",
    )

    # ── mobile.devices ───────────────────────────────────────────────────────
    # Palmare associato a un negozio. device_token a lunga scadenza (1 anno),
    # revocabile via admin UI.
    op.create_table(
        "devices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("device_token", sa.String(128), nullable=False, unique=True),
        sa.Column("store_code", sa.String(20), nullable=False),
        sa.Column(
            "paired_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "paired_by_user",
            UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        # Metadata opzionali mandati dal palmare al momento del pair: device
        # model, android version, app version. JSON libero per non vincolare
        # ora lo schema se in futuro vogliamo tracciare altro.
        sa.Column("device_info", JSONB, nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "revoked_by_user",
            UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            onupdate=sa.func.now(),
            nullable=True,
        ),
        schema="mobile",
    )
    op.create_index(
        "ix_mobile_devices_device_token",
        "devices",
        ["device_token"],
        unique=True,
        schema="mobile",
    )
    op.create_index(
        "ix_mobile_devices_store_code",
        "devices",
        ["store_code"],
        schema="mobile",
    )
    op.create_index(
        "ix_mobile_devices_active",
        "devices",
        ["is_active", "store_code"],
        schema="mobile",
    )

    # FK differita: mobile.pairing_tokens.used_by_device → mobile.devices.id
    # (aggiunta ora che la tabella devices esiste)
    op.create_foreign_key(
        "fk_pairing_tokens_used_by_device",
        source_table="pairing_tokens",
        referent_table="devices",
        local_cols=["used_by_device"],
        remote_cols=["id"],
        source_schema="mobile",
        referent_schema="mobile",
    )

    # ── mobile.scanner_sessions ──────────────────────────────────────────────
    # Una sessione = una raccolta di codici scansionati dal palmare e
    # inviata a FTC HUB. Lifecycle: pending → taken → consumed (o dismissed).
    op.create_table(
        "scanner_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("store_code", sa.String(20), nullable=False),
        sa.Column(
            "created_by_device",
            UUID(as_uuid=True),
            sa.ForeignKey("mobile.devices.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        # Stato della sessione:
        #   pending   — disponibile per i PC del negozio
        #   taken     — un PC l'ha presa in carico (taken_by_user valorizzato)
        #   consumed  — PC ha stampato / archiviato la sessione
        #   dismissed — scartata senza stampare
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "taken_by_user",
            UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id"),
            nullable=True,
        ),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.CheckConstraint(
            "status IN ('pending', 'taken', 'consumed', 'dismissed')",
            name="ck_scanner_sessions_status",
        ),
        schema="mobile",
    )
    op.create_index(
        "ix_mobile_scanner_sessions_store_status",
        "scanner_sessions",
        ["store_code", "status"],
        schema="mobile",
    )
    op.create_index(
        "ix_mobile_scanner_sessions_device",
        "scanner_sessions",
        ["created_by_device"],
        schema="mobile",
    )

    # ── mobile.scanner_session_items ─────────────────────────────────────────
    # I singoli codici scansionati. Il raw_code è quello che è uscito dallo
    # scanner (zebra, barcode, barcode_ext), il matching vero avverrà lato
    # backend al momento dell'import in Stampa Etichette (usa la stessa
    # pipeline di enrich che riconosce item_no / barcode / barcode_ext).
    op.create_table(
        "scanner_session_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("mobile.scanner_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("raw_code", sa.String(64), nullable=False),
        sa.Column(
            "scanned_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        # EXPO suggerito dal collaboratore in corsia (può essere null).
        # Il PC in back office può sempre sovrascriverlo prima di stampare.
        sa.Column("suggested_expo", sa.String(20), nullable=True),
        sa.Column("copies", sa.Integer, nullable=False, server_default="1"),
        # Posizione originale nell'ordine di scansione (utile per ricostruire
        # la sequenza quando il palmare aveva più keyword EXPO in una sessione)
        sa.Column("position", sa.Integer, nullable=False),
        sa.CheckConstraint(
            "suggested_expo IS NULL OR suggested_expo IN ('TABLE', 'WALL', 'BUCKET')",
            name="ck_scanner_session_items_expo",
        ),
        sa.CheckConstraint("copies >= 1 AND copies <= 99", name="ck_scanner_session_items_copies"),
        schema="mobile",
    )
    op.create_index(
        "ix_mobile_scanner_session_items_session",
        "scanner_session_items",
        ["session_id"],
        schema="mobile",
    )


def downgrade():
    op.drop_table("scanner_session_items", schema="mobile")
    op.drop_table("scanner_sessions", schema="mobile")
    # Rimuovi la FK aggiunta dopo la creazione di devices
    op.drop_constraint(
        "fk_pairing_tokens_used_by_device",
        "pairing_tokens",
        type_="foreignkey",
        schema="mobile",
    )
    op.drop_table("devices", schema="mobile")
    op.drop_table("pairing_tokens", schema="mobile")
    op.execute("DROP SCHEMA IF EXISTS mobile")
