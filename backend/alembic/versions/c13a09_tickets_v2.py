"""Tickets v2: categorie, sottocategorie, team, routing rules

Revision ID: c13a09ticketsv2
Revises: c13a08tickets01
Create Date: 2026-03-16 13:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "c13a09ticketsv2"
down_revision = "c13a08tickets01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Crea le 5 nuove tabelle di configurazione ───────────────────────────

    op.create_table(
        "ticket_categories",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        schema="tickets",
    )

    op.create_table(
        "ticket_subcategories",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("tickets.ticket_categories.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("category_id", "name", name="uq_subcategory_category_name"),
        schema="tickets",
    )

    op.create_table(
        "ticket_teams",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        schema="tickets",
    )

    op.create_table(
        "ticket_team_members",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("team_id", sa.Integer, sa.ForeignKey("tickets.ticket_teams.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=False),
        sa.Column("is_team_lead", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_member"),
        schema="tickets",
    )

    op.create_table(
        "ticket_routing_rules",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("tickets.ticket_categories.id"), nullable=False),
        sa.Column("subcategory_id", sa.Integer, sa.ForeignKey("tickets.ticket_subcategories.id"), nullable=True),
        sa.Column("team_id", sa.Integer, sa.ForeignKey("tickets.ticket_teams.id"), nullable=True),
        sa.Column("assigned_user_id", UUID(as_uuid=True), sa.ForeignKey("auth.users.id"), nullable=True),
        sa.Column("priority_override", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("category_id", "subcategory_id", name="uq_routing_rule_cat_subcat"),
        schema="tickets",
    )

    # ── 2. Seed categorie ──────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO tickets.ticket_categories (name, description, sort_order) VALUES
        ('Hardware',           'Problemi con dispositivi fisici (PC, stampanti, ecc.)',  10),
        ('Software',           'Problemi con applicazioni e software',                   20),
        ('Rete',               'Problemi di connettività e rete',                        30),
        ('NAV / ERP',          'Problemi con Microsoft Dynamics NAV o ERP',              40),
        ('Accessi e permessi', 'Problemi con accessi, credenziali e permessi',            50),
        ('Altro',              'Richieste non classificabili in altre categorie',          60)
    """)

    # ── 3. Seed sottocategorie ─────────────────────────────────────────────────
    op.execute("""
        INSERT INTO tickets.ticket_subcategories (category_id, name, description, sort_order)
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Hardware'), 'PC / Laptop',       'Desktop e laptop aziendali',  10
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Hardware'), 'Stampante',         'Stampanti e scanner',          20
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Hardware'), 'Periferiche',       'Mouse, tastiera, monitor',     30
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Software'), 'Office 365',        'Suite Microsoft Office',       10
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Software'), 'Antivirus',         'Problemi antivirus e sicurezza', 20
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Software'), 'OS Windows',        'Problemi sistema operativo',   30
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Rete'),     'Wi-Fi',             'Connessione wireless',         10
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Rete'),     'VPN',               'Connessione VPN aziendale',    20
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'NAV / ERP'), 'Dati vendite',     'Import/export dati vendite',   10
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'NAV / ERP'), 'Credenziali NAV',  'Accesso a Navision',            20
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Accessi e permessi'), 'Reset password', 'Reset credenziali account', 10
        UNION ALL
        SELECT (SELECT id FROM tickets.ticket_categories WHERE name = 'Accessi e permessi'), 'Nuovo utente',   'Creazione nuovo account',   20
    """)

    # ── 4. Seed team ───────────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO tickets.ticket_teams (name, description, email) VALUES
        ('IT Support',    'Team supporto IT generale',                 ''),
        ('IT Network',    'Team specializzato in infrastruttura e rete', ''),
        ('IT ERP',        'Team supporto NAV / ERP',                   ''),
        ('IT Security',   'Team sicurezza e accessi',                  '')
    """)

    # ── 5. Seed routing rules ──────────────────────────────────────────────────
    op.execute("""
        INSERT INTO tickets.ticket_routing_rules (category_id, subcategory_id, team_id, priority_override)
        SELECT
            (SELECT id FROM tickets.ticket_categories WHERE name = 'Hardware'),
            NULL::integer,
            (SELECT id FROM tickets.ticket_teams WHERE name = 'IT Support'),
            NULL::varchar
        UNION ALL
        SELECT
            (SELECT id FROM tickets.ticket_categories WHERE name = 'Software'),
            NULL::integer,
            (SELECT id FROM tickets.ticket_teams WHERE name = 'IT Support'),
            NULL::varchar
        UNION ALL
        SELECT
            (SELECT id FROM tickets.ticket_categories WHERE name = 'Rete'),
            NULL::integer,
            (SELECT id FROM tickets.ticket_teams WHERE name = 'IT Network'),
            NULL::varchar
        UNION ALL
        SELECT
            (SELECT id FROM tickets.ticket_categories WHERE name = 'NAV / ERP'),
            NULL::integer,
            (SELECT id FROM tickets.ticket_teams WHERE name = 'IT ERP'),
            'high'::varchar
        UNION ALL
        SELECT
            (SELECT id FROM tickets.ticket_categories WHERE name = 'Accessi e permessi'),
            NULL::integer,
            (SELECT id FROM tickets.ticket_teams WHERE name = 'IT Security'),
            NULL::varchar
        UNION ALL
        SELECT
            (SELECT id FROM tickets.ticket_categories WHERE name = 'Altro'),
            NULL::integer,
            (SELECT id FROM tickets.ticket_teams WHERE name = 'IT Support'),
            NULL::varchar
    """)

    # ── 6. Aggiungi colonne a tickets.tickets ──────────────────────────────────
    op.add_column("tickets", sa.Column("category_id", sa.Integer, nullable=True), schema="tickets")
    op.add_column("tickets", sa.Column("subcategory_id", sa.Integer, nullable=True), schema="tickets")
    op.add_column("tickets", sa.Column("team_id", sa.Integer, nullable=True), schema="tickets")

    # ── 7. Migra dati: mappa il vecchio campo text category → category_id ──────
    op.execute("""
        UPDATE tickets.tickets t
        SET category_id = (
            SELECT c.id FROM tickets.ticket_categories c
            WHERE c.name = CASE t.category
                WHEN 'hardware' THEN 'Hardware'
                WHEN 'software' THEN 'Software'
                WHEN 'network'  THEN 'Rete'
                WHEN 'nav_erp'  THEN 'NAV / ERP'
                WHEN 'access'   THEN 'Accessi e permessi'
                WHEN 'other'    THEN 'Altro'
                ELSE NULL
            END
            LIMIT 1
        )
        WHERE t.category IS NOT NULL
    """)

    # ── 8. Rimuovi la vecchia colonna category ─────────────────────────────────
    op.drop_column("tickets", "category", schema="tickets")

    # ── 9. Aggiunge FK constraints ─────────────────────────────────────────────
    op.create_foreign_key(
        "fk_tickets_category_id",
        "tickets", "ticket_categories",
        ["category_id"], ["id"],
        source_schema="tickets", referent_schema="tickets",
    )
    op.create_foreign_key(
        "fk_tickets_subcategory_id",
        "tickets", "ticket_subcategories",
        ["subcategory_id"], ["id"],
        source_schema="tickets", referent_schema="tickets",
    )
    op.create_foreign_key(
        "fk_tickets_team_id",
        "tickets", "ticket_teams",
        ["team_id"], ["id"],
        source_schema="tickets", referent_schema="tickets",
    )

    # ── 10. Drappa il vecchio enum ticketcategory se esiste ────────────────────
    op.execute("DROP TYPE IF EXISTS tickets.ticketcategory")

    # ── 11. Permesso tickets.admin ─────────────────────────────────────────────
    op.execute("""
        INSERT INTO auth.permissions (id, code, name, description, module, is_active)
        SELECT gen_random_uuid(), 'tickets.admin', 'Tickets Admin', 'Configurazione ticketing (categorie, team, regole)', 'tickets', true
        WHERE NOT EXISTS (
            SELECT 1 FROM auth.permissions WHERE code = 'tickets.admin'
        )
    """)

    op.execute("""
        INSERT INTO auth.role_permissions (id, role_id, permission_id)
        SELECT gen_random_uuid(), r.id, p.id
        FROM auth.roles r
        JOIN auth.permissions p ON p.code = 'tickets.admin'
        WHERE r.code = 'ADMIN'
          AND NOT EXISTS (
              SELECT 1 FROM auth.role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """)

    op.execute("""
        INSERT INTO auth.role_permission_scopes (id, role_id, permission_id, scope_id, is_active)
        SELECT gen_random_uuid(), r.id, p.id, s.id, true
        FROM auth.roles r
        JOIN auth.permissions p ON p.code = 'tickets.admin'
        JOIN auth.role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
        JOIN auth.scopes s ON s.scope_type = 'GLOBAL' AND s.scope_code = 'GLOBAL'
        WHERE r.code = 'ADMIN'
          AND NOT EXISTS (
              SELECT 1 FROM auth.role_permission_scopes rps
              WHERE rps.role_id = r.id AND rps.permission_id = p.id AND rps.scope_id = s.id
          )
    """)


def downgrade() -> None:
    # Rimuovi permesso tickets.admin
    op.execute("""
        DELETE FROM auth.role_permission_scopes
        WHERE permission_id IN (
            SELECT id FROM auth.permissions WHERE code = 'tickets.admin'
        )
    """)
    op.execute("""
        DELETE FROM auth.role_permissions
        WHERE permission_id IN (
            SELECT id FROM auth.permissions WHERE code = 'tickets.admin'
        )
    """)
    op.execute("DELETE FROM auth.permissions WHERE code = 'tickets.admin'")

    # Ricrea colonna category
    op.add_column("tickets", sa.Column("category", sa.Text, nullable=True), schema="tickets")

    # Reverse migration data
    op.execute("""
        UPDATE tickets.tickets t
        SET category = (
            SELECT CASE c.name
                WHEN 'Hardware'           THEN 'hardware'
                WHEN 'Software'           THEN 'software'
                WHEN 'Rete'               THEN 'network'
                WHEN 'NAV / ERP'          THEN 'nav_erp'
                WHEN 'Accessi e permessi' THEN 'access'
                WHEN 'Altro'              THEN 'other'
                ELSE 'other'
            END
            FROM tickets.ticket_categories c
            WHERE c.id = t.category_id
        )
    """)

    # Rimuovi FK e colonne
    op.drop_constraint("fk_tickets_team_id", "tickets", schema="tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_subcategory_id", "tickets", schema="tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_category_id", "tickets", schema="tickets", type_="foreignkey")
    op.drop_column("tickets", "team_id", schema="tickets")
    op.drop_column("tickets", "subcategory_id", schema="tickets")
    op.drop_column("tickets", "category_id", schema="tickets")

    # Drappa tabelle di configurazione
    op.drop_table("ticket_routing_rules", schema="tickets")
    op.drop_table("ticket_team_members", schema="tickets")
    op.drop_table("ticket_teams", schema="tickets")
    op.drop_table("ticket_subcategories", schema="tickets")
    op.drop_table("ticket_categories", schema="tickets")
