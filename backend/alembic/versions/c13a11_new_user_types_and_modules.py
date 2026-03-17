"""new user types and modules config

Revision ID: c13a11modules01
Revises: c13a10usertype01
Create Date: 2026-03-17 19:30:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'c13a11modules01'
down_revision: str = 'c13a10usertype01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1 — Ricrea user_type_enum con nuovi valori (aggiunge HR/FINANCE/MARKETING/IT/COMMERCIAL, rimuove HO)
    op.execute("ALTER TYPE auth.user_type_enum RENAME TO user_type_enum_old;")
    op.execute("""
        CREATE TYPE auth.user_type_enum AS ENUM (
            'SUPERUSER', 'ADMIN', 'HR', 'FINANCE', 'MARKETING', 'IT', 'COMMERCIAL', 'DM', 'STORE'
        );
    """)
    # Rimuovi il default prima di cambiare tipo (impedisce il cast automatico)
    op.execute("ALTER TABLE auth.users ALTER COLUMN user_type DROP DEFAULT;")
    # Converti HO → COMMERCIAL e cambia tipo colonna
    op.execute("""
        ALTER TABLE auth.users
            ALTER COLUMN user_type TYPE auth.user_type_enum
            USING (
                CASE
                    WHEN user_type::text = 'HO' THEN 'COMMERCIAL'::auth.user_type_enum
                    ELSE user_type::text::auth.user_type_enum
                END
            );
    """)
    # Ripristina il default
    op.execute("ALTER TABLE auth.users ALTER COLUMN user_type SET DEFAULT 'STORE';")
    op.execute("DROP TYPE auth.user_type_enum_old;")

    # 2 — Crea tabella ho.modules
    op.create_table(
        'modules',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('has_view', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('has_manage', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.now()),
        schema='ho',
    )

    # 3 — Crea tabella ho.user_type_module_access
    op.create_table(
        'user_type_module_access',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_type', sa.String(20), nullable=False),
        sa.Column('module_code', sa.String(50), nullable=False),
        sa.Column('can_view', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('can_manage', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_type', 'module_code', name='uq_usertype_module'),
        schema='ho',
    )

    # 4 — Crea tabella auth.user_module_permissions (override per singolo utente)
    op.create_table(
        'user_module_permissions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('module_code', sa.String(50), nullable=False),
        sa.Column('can_view', sa.Boolean(), nullable=True),
        sa.Column('can_manage', sa.Boolean(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'module_code', name='uq_user_module'),
        schema='auth',
    )

    # 5 — Seed moduli
    op.execute("""
        INSERT INTO ho.modules (code, name, has_view, has_manage, sort_order) VALUES
            ('sales',            'Sales Data',           true,  true,  10),
            ('navision',         'Navision',             true,  true,  20),
            ('tickets',          'Tickets',              true,  true,  30),
            ('writedown',        'Writedown Store',      true,  true,  40),
            ('check_merce',      'Check Merce',          true,  true,  50),
            ('info_prodotto',    'Info Prodotto',        true,  false, 60),
            ('picking_list',     'Picking List',         true,  true,  70),
            ('trasferimenti',    'Trasferimenti Interni',true,  true,  80),
            ('writedown_ho',     'Writedown HO',         true,  true,  90),
            ('item_list',        'Item List',            true,  false, 100),
            ('stock',            'Stock',                true,  false, 110),
            ('ordini',           'Ordini',               true,  true,  120),
            ('file_ftp',         'File FTP',             true,  true,  130),
            ('online_offline',   'Online/Offline',       true,  false, 140),
            ('codici_operatore', 'Codici Operatore',     true,  true,  150),
            ('licenze',          'Licenze',              true,  true,  999)
        ON CONFLICT (code) DO NOTHING;
    """)

    # 6 — Seed accessi di default per user_type
    # HR: moduli HR-oriented
    # FINANCE: moduli finanziari
    # COMMERCIAL: moduli commerciali (ex HO)
    # MARKETING: moduli marketing
    # IT: tutti i moduli tecnici
    # DM: moduli operativi store
    # STORE: moduli base store
    op.execute("""
        INSERT INTO ho.user_type_module_access (user_type, module_code, can_view, can_manage) VALUES
            -- COMMERCIAL (ex HO) — accesso quasi completo
            ('COMMERCIAL', 'sales',            true,  true),
            ('COMMERCIAL', 'navision',         true,  true),
            ('COMMERCIAL', 'tickets',          true,  true),
            ('COMMERCIAL', 'writedown',        true,  false),
            ('COMMERCIAL', 'check_merce',      true,  false),
            ('COMMERCIAL', 'info_prodotto',    true,  false),
            ('COMMERCIAL', 'picking_list',     true,  false),
            ('COMMERCIAL', 'trasferimenti',    true,  false),
            ('COMMERCIAL', 'writedown_ho',     true,  true),
            ('COMMERCIAL', 'item_list',        true,  false),
            ('COMMERCIAL', 'stock',            true,  false),
            ('COMMERCIAL', 'ordini',           true,  true),
            ('COMMERCIAL', 'file_ftp',         true,  true),
            ('COMMERCIAL', 'online_offline',   true,  false),
            ('COMMERCIAL', 'codici_operatore', true,  false),

            -- HR
            ('HR', 'tickets',          true,  true),
            ('HR', 'online_offline',   true,  false),
            ('HR', 'codici_operatore', true,  true),

            -- FINANCE
            ('FINANCE', 'sales',         true,  false),
            ('FINANCE', 'tickets',       true,  true),
            ('FINANCE', 'writedown_ho',  true,  false),
            ('FINANCE', 'stock',         true,  false),
            ('FINANCE', 'ordini',        true,  false),

            -- MARKETING
            ('MARKETING', 'sales',         true,  false),
            ('MARKETING', 'tickets',       true,  true),
            ('MARKETING', 'info_prodotto', true,  false),
            ('MARKETING', 'item_list',     true,  false),
            ('MARKETING', 'stock',         true,  false),

            -- IT
            ('IT', 'sales',            true,  false),
            ('IT', 'navision',         true,  true),
            ('IT', 'tickets',          true,  true),
            ('IT', 'file_ftp',         true,  true),
            ('IT', 'online_offline',   true,  false),
            ('IT', 'codici_operatore', true,  true),

            -- DM
            ('DM', 'sales',            true,  false),
            ('DM', 'tickets',          true,  true),
            ('DM', 'writedown',        true,  false),
            ('DM', 'check_merce',      true,  false),
            ('DM', 'info_prodotto',    true,  false),
            ('DM', 'picking_list',     true,  true),
            ('DM', 'trasferimenti',    true,  true),
            ('DM', 'item_list',        true,  false),
            ('DM', 'stock',            true,  false),
            ('DM', 'online_offline',   true,  false),

            -- STORE
            ('STORE', 'tickets',          true,  true),
            ('STORE', 'writedown',        true,  true),
            ('STORE', 'check_merce',      true,  true),
            ('STORE', 'info_prodotto',    true,  false),
            ('STORE', 'picking_list',     true,  true),
            ('STORE', 'trasferimenti',    true,  true),
            ('STORE', 'item_list',        true,  false),
            ('STORE', 'stock',            true,  false),
            ('STORE', 'online_offline',   true,  false)

        ON CONFLICT (user_type, module_code) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table('user_module_permissions', schema='auth')
    op.drop_table('user_type_module_access', schema='ho')
    op.drop_table('modules', schema='ho')

    # Ripristina enum originale
    op.execute("ALTER TYPE auth.user_type_enum RENAME TO user_type_enum_old;")
    op.execute("""
        CREATE TYPE auth.user_type_enum AS ENUM (
            'SUPERUSER', 'ADMIN', 'HO', 'DM', 'STORE'
        );
    """)
    op.execute("UPDATE auth.users SET user_type = 'HO' WHERE user_type IN ('HR','FINANCE','MARKETING','IT','COMMERCIAL')")
    op.execute("""
        ALTER TABLE auth.users
            ALTER COLUMN user_type TYPE auth.user_type_enum
            USING user_type::text::auth.user_type_enum;
    """)
    op.execute("DROP TYPE auth.user_type_enum_old;")
