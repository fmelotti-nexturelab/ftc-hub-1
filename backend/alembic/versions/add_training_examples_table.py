"""Aggiunge tabella tickets.training_examples per gestione CRUD esempi AI

Revision ID: training_examples_001
Revises: remove_resolved_001
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa

revision = "training_examples_001"
down_revision = "remove_resolved_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "training_examples",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("category_name", sa.String(100), nullable=False),
        sa.Column("subcategory_name", sa.String(100), nullable=True),
        sa.Column("team_name", sa.String(100), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        schema="tickets",
    )

    # Importa i 102 esempi esistenti dal file di training
    examples = [
        ("WiFi non disponibile", "IT", "Rete & Connettività", "IT", "medium"),
        ("Richiesta secondo monitor", "IT", "Hardware", "IT", "low"),
        ("Excel si chiude da solo", "IT", "Tool & Applicativi", "IT", "medium"),
        ("PC si riavvia da solo", "IT", "Hardware", "IT", "medium"),
        ("Errore certificato sito interno", "IT", "Software & Sistemi", "IT", "high"),
        ("Schermo stampante rotto", "IT", "Hardware", "IT", "low"),
        ("Disco quasi pieno", "IT", "Hardware", "IT", "low"),
        ("Problema audio cuffie", "IT", "Hardware", "IT", "low"),
        ("PC non si accende", "IT", "Hardware", "IT", "medium"),
        ("PC non si accende", "IT", "Hardware", "IT", "medium"),
        ("Richiesta nuovo mouse", "IT", "Hardware", "IT", "low"),
        ("Disco quasi pieno", "IT", "Hardware", "IT", "low"),
        ("Richiesta reset password", "IT", "Windows - MS OFFICE - NAV ", "IT", "medium"),
        ("Errore certificato sito interno", "IT", "Software & Sistemi", "IT", "high"),
        ("Antivirus blocca programma", "IT", "Software & Sistemi", "IT", "low"),
        ("Tastiera non risponde", "IT", "Hardware", "IT", "medium"),
        ("Schermo touch non calibrato", "IT", "Cassa , POS, Stampante EPSON, Misuratore Fiscale", "IT", "medium"),
        ("Errore stampa scontrino", "IT", "Cassa , POS, Stampante EPSON, Misuratore Fiscale", "IT", "high"),
        ("Telefono aziendale guasto", "IT", "Hardware", "IT", "low"),
        ("POS non legge carte contactless", "IT", "Cassa , POS, Stampante EPSON, Misuratore Fiscale", "IT", "high"),
        ("Scanner codici a barre rotto", "IT", "Cassa , POS, Stampante EPSON, Misuratore Fiscale", "IT", "high"),
        ("Problemi VPN da casa", "IT", "Rete & Connettività", "IT", "medium"),
        ("Problema email aziendale", "IT", "Windows - MS OFFICE - NAV ", "IT", "medium"),
        ("Software gestionale bloccato", "IT", "Software & Sistemi", "IT", "medium"),
        ("Antivirus blocca programma", "IT", None, "IT", "medium"),
        ("Problema audio cuffie", "IT", None, "IT", "high"),
        ("Aggiornamento Windows fallito", "IT", None, "IT", "high"),
        ("Aggiornamento Windows fallito", "IT", None, "IT", "medium"),
        ("PC molto lento", "IT", None, "IT", "medium"),
        ("WiFi non disponibile", "IT", None, "IT", "low"),
        ("Richiesta secondo monitor", "IT", None, "IT", "high"),
        ("Porta USB non funziona", "IT", None, "IT", "medium"),
        ("Errore certificato sito interno", "COMMERCIAL", "Promozioni", "COMMERCIAL", "medium"),
        ("WiFi non disponibile", "RETAIL", "Display & Allestimento", "RETAIL", "high"),
        ("WiFi non disponibile", "MARKETING", "GLOVO", "MARKETING", "medium"),
        ("Errore apertura file Excel", "MARKETING", "GLOVO", "MARKETING", "high"),
        ("PC si riavvia da solo", "MARKETING", "Comunicazioni Negozio", "MARKETING", "low"),
        ("Backup fallito", "COMMERCIAL", "Reporting Vendite", "COMMERCIAL", "medium"),
        ("Richiesta secondo monitor", "COMMERCIAL", "Promozioni", "COMMERCIAL", "high"),
        ("WiFi non disponibile", "COMMERCIAL", "Promozioni", "COMMERCIAL", "low"),
        ("Richiesta nuovo mouse", "FINANCE", "GYB  emissione fattura", "FINANCE", "high"),
        ("Errore apertura file Excel", "RETAIL", "Apertura / Chiusura Negozio", "RETAIL", "high"),
        ("Teams non funziona", "RETAIL", "Cassa & Pagamenti", "RETAIL", "medium"),
        ("POS non legge carte contactless", "COMMERCIAL", "Promozioni", "COMMERCIAL", "medium"),
        ("Errore sincronizzazione OneDrive", "MARKETING", "Comunicazioni Negozio", "MARKETING", "high"),
        ("Porta USB non funziona", "COMMERCIAL", "Promozioni", "COMMERCIAL", "high"),
        ("Webcam non rilevata", "MARKETING", "Materiali Promozionali", "MARKETING", "medium"),
        ("Monitor nero", "HEALTH & SAFETY", "Sicurezza Struttura", "HEALTH & SAFETY", "low"),
        ("Tastiera non risponde", "IT", "Software & Sistemi", "IT", "low"),
        ("Richiesta secondo monitor", "HEALTH & SAFETY", "DPI & Normativa", "HEALTH & SAFETY", "low"),
        ("Richiesta secondo monitor", "COMMERCIAL", "Prezzi", "COMMERCIAL", "high"),
        ("Monitor nero", "FACILITIES", "Pulizie & Forniture", "FACILITIES", "medium"),
        ("Problema audio cuffie", "HEALTH & SAFETY", "DPI & Normativa", "HEALTH & SAFETY", "high"),
        ("Aggiornamento Windows fallito", "FACILITIES", "Pulizie & Forniture", "FACILITIES", "low"),
        ("Problema email aziendale", "MARKETING", "Campagne", "MARKETING", "medium"),
        ("Schermo touch non calibrato", "HR", "Malattie & Congedi", "HR", "medium"),
        ("Richiesta accesso cartella condivisa", "COMMERCIAL", "Promozioni", "COMMERCIAL", "high"),
        ("Porta USB non funziona", "INTERNO HO", "Richiesta Generica", "IT", "low"),
        ("PC si riavvia da solo", "HEALTH & SAFETY", "DPI & Normativa", "HEALTH & SAFETY", "medium"),
        ("Richiesta reset password", "INTERNO HO", "Richiesta Generica", "IT", "high"),
        ("Teams non funziona", "FACILITIES", "Climatizzazione & Illuminazione", "FACILITIES", "high"),
        ("Teams non funziona", "FINANCE", "Fatturazione & Fornitori", "FINANCE", "medium"),
        ("Antivirus blocca programma", "IT", "Tool & Applicativi", "IT", "high"),
        ("Problema connessione NAV", "FACILITIES", "Manutenzione Negozio", "FACILITIES", "high"),
        ("Richiesta accesso cartella condivisa", "FACILITIES", "Manutenzione Negozio", "FACILITIES", "medium"),
        ("Stampante non funziona", "COMMERCIAL", "Promozioni", "COMMERCIAL", "medium"),
        ("Backup fallito", "FACILITIES", "Climatizzazione & Illuminazione", "FACILITIES", "critical"),
        ("Scanner codici a barre rotto", "MARKETING", "Materiali Promozionali", "MARKETING", "high"),
        ("Problema proiettore sala riunioni", "HR", "Malattie & Congedi", "HR", "low"),
        ("WiFi non disponibile", "FINANCE", "GYB  emissione fattura", "FINANCE", "medium"),
        ("Errore stampa scontrino", "COMMERCIAL", "Richiesta Trasferimento Interno", "COMMERCIAL", "medium"),
        ("Errore apertura file Excel", "COMMERCIAL", "Promozioni", "COMMERCIAL", "low"),
        ("Problema cassa", "FACILITIES", "Climatizzazione & Illuminazione", "FACILITIES", "high"),
        ("Errore sincronizzazione OneDrive", "HR", "Presenze & Turni", "HR", "medium"),
        ("Richiesta installazione software", "RETAIL", "Cassa & Pagamenti", "RETAIL", "high"),
        ("Problema audio cuffie", "RETAIL", "Apertura / Chiusura Negozio", "RETAIL", "low"),
        ("Excel si chiude da solo", "HR", "Note Spese & Rimborsi", "HR", "medium"),
        ("Excel si chiude da solo", "RETAIL", "Apertura / Chiusura Negozio", "RETAIL", "medium"),
        ("Problemi VPN da casa", "HR", "Formazione", "HR", "medium"),
        ("Richiesta reset password", "INTERNO HO", "Richiesta Generica", "IT", "high"),
        ("Errore stampa scontrino", "HR", "Formazione", "HR", "medium"),
        ("Problema email aziendale", "INTERNO HO", "Richiesta Generica", "IT", "low"),
        ("Richiesta nuovo mouse", "COMMERCIAL", "Richiesta Trasferimento Interno", "COMMERCIAL", "medium"),
        ("VPN si disconnette spesso", "FINANCE", "Cassa & Riconciliazione", "FINANCE", "critical"),
        ("Webcam non rilevata", "IT", "TICKET - gestione di un ticket", "IT", "high"),
        ("Antivirus blocca programma", "FACILITIES", "Climatizzazione & Illuminazione", "FACILITIES", "critical"),
        ("Excel si chiude da solo", "MARKETING", "Materiali Promozionali", "MARKETING", "low"),
        ("Tastiera non risponde", "MARKETING", "Comunicazioni Negozio", "MARKETING", "low"),
        ("Telefono aziendale guasto", "RETAIL", "Display & Allestimento", "RETAIL", "low"),
        ("Excel si chiude da solo", "HR", "Buste Paga & Amministrazione", "HR", "low"),
        ("Software gestionale bloccato", "RETAIL", "Display & Allestimento", "RETAIL", "high"),
        ("Schermo touch non calibrato", "MARKETING", "Campagne", "MARKETING", "low"),
        ("Stampante non funziona", "HR", "Formazione", "HR", "medium"),
        ("Porta USB non funziona", "HEALTH & SAFETY", "Segnalazione Incidente", "HEALTH & SAFETY", "high"),
        ("Badge non riconosciuto", "HEALTH & SAFETY", "DPI & Normativa", "HEALTH & SAFETY", "medium"),
        ("PC si riavvia da solo", "HR", "Presenze & Turni", "HR", "medium"),
        ("Aggiornamento Windows fallito", "HEALTH & SAFETY", "Sicurezza Struttura", "HEALTH & SAFETY", "medium"),
        ("Richiesta secondo monitor", "COMMERCIAL", "Promozioni", "COMMERCIAL", "medium"),
        ("Richiesta nuovo mouse", "FACILITIES", "Manutenzione Negozio", "FACILITIES", "low"),
        ("Outlook non sincronizza", "RETAIL", "Cassa & Pagamenti", "RETAIL", "high"),
        ("Stampante non funziona", "FINANCE", "Budget & Previsioni", "FINANCE", "low"),
        ("Badge non riconosciuto", "HEALTH & SAFETY", "Segnalazione Incidente", "HEALTH & SAFETY", "medium"),
    ]

    # Bulk insert
    table = sa.table(
        "training_examples",
        sa.column("title", sa.String),
        sa.column("description", sa.String),
        sa.column("category_name", sa.String),
        sa.column("subcategory_name", sa.String),
        sa.column("team_name", sa.String),
        sa.column("priority", sa.String),
        schema="tickets",
    )
    op.bulk_insert(table, [
        {
            "title": t, "description": None,
            "category_name": c, "subcategory_name": s,
            "team_name": tm, "priority": p,
        }
        for t, c, s, tm, p in examples
    ])


def downgrade() -> None:
    op.drop_table("training_examples", schema="tickets")
