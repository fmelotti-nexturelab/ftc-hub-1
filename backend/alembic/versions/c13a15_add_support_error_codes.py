"""add support_error_codes table with seed data

Revision ID: c13a15
Revises: c13a14
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "c13a15"
down_revision = "c13a14"
branch_labels = None
depends_on = None

CODES = [
    # ── Accesso e permessi ────────────────────────────────────────────────────
    ("TCKT-0001", "tickets", "Utente STORE vede ticket di altri negozi",
     "Il test di accesso con utente STORE ha fallito: l'utente vede ticket appartenenti ad altri negozi. "
     "Controlla il filtro per user_type in services/tickets/ticket_service.py nella funzione get_tickets() — "
     "verifica la logica del blocco 'user_type == UserType.STOREMANAGER' e la funzione _get_user_store_number(). "
     "Controlla anche che UserAssignment restituisca il store_code corretto per quell'utente."),

    ("TCKT-0002", "tickets", "Utente IT non vede tutti i ticket o mancano i filtri avanzati",
     "Il test di accesso con utente IT ha fallito: l'utente non vede tutti i ticket oppure i filtri "
     "avanzati (team, assegnatario) non compaiono. Controlla la funzione _check_manage() in "
     "routers/tickets/tickets.py e il flag is_manager passato a get_tickets() in ticket_service.py. "
     "Verifica che _user_can_access_module() in core/dependencies.py ritorni True per user_type IT."),

    ("TCKT-0003", "tickets", "SUPERUSER non vede statistiche per assegnatario o storico completo",
     "Il test di accesso con utente SUPERUSER ha fallito: mancano le statistiche per assegnatario "
     "o lo storico non mostra tutti i ticket. Controlla il controllo 'user_type == UserType.SUPERUSER' "
     "in ticket_service.py nelle funzioni ticket_stats() e get_history()."),

    # ── Creazione ticket ──────────────────────────────────────────────────────
    ("TCKT-0004", "tickets", "Dati richiedente non pre-compilati nel form",
     "Il test di creazione ticket ha fallito: i dati richiedente (nome, email, telefono) non vengono "
     "pre-compilati automaticamente. Controlla l'endpoint GET /api/tickets/requester-defaults in "
     "routers/tickets/tickets.py e la logica di lettura da UserAssignment e Store per gli utenti STOREMANAGER."),

    ("TCKT-0005", "tickets", "Validazione form non blocca l'invio con campi mancanti",
     "Il test di validazione form ha fallito: il form viene inviato anche con campi obbligatori mancanti "
     "oppure non mostra l'errore. Controlla la validazione in frontend/src/pages/tickets/TicketCreate.jsx "
     "e lo schema Pydantic TicketCreate in backend/app/schemas/tickets.py — verifica i campi required."),

    ("TCKT-0006", "tickets", "Creazione ticket fallisce con errore 422 o 500",
     "Il test di creazione ticket ha fallito con errore HTTP. Controlla i log del backend con "
     "'docker compose logs -f backend' subito dopo il tentativo di creazione. "
     "Esamina create_ticket() in services/tickets/ticket_service.py e lo schema TicketCreate "
     "in schemas/tickets.py. Verifica che tutti i campi obbligatori siano presenti nella richiesta."),

    ("TCKT-0007", "tickets", "Notifica in-app non arriva agli utenti IT dopo creazione ticket",
     "Il test notifiche ha fallito: dopo la creazione di un ticket gli utenti IT/SUPERUSER non ricevono "
     "la notifica in-app entro 30 secondi. Controlla push_to_many() in services/tickets/notification_service.py "
     "e il blocco notifiche in create_ticket() di ticket_service.py. Verifica che _get_manager_user_ids() "
     "restituisca gli UUID corretti degli utenti IT/SUPERUSER attivi."),

    # ── Lista ticket ──────────────────────────────────────────────────────────
    ("TCKT-0008", "tickets", "Filtro per stato nella lista ticket non funziona",
     "Il test filtri lista ticket ha fallito: il filtro per stato non aggiorna la lista. "
     "Controlla il parametro 'status' in routers/tickets/tickets.py nella funzione list_tickets() "
     "e il filtro corrispondente in ticket_service.py → get_tickets(). "
     "Verifica anche la chiamata API in frontend/src/api/tickets.js."),

    ("TCKT-0009", "tickets", "Bulk actions non funzionano sulla lista ticket",
     "Il test bulk actions ha fallito: la selezione multipla o le azioni (chiudi, cambia stato, assegna) "
     "non producono effetto. Controlla l'endpoint PUT /api/tickets/bulk in routers/tickets/tickets.py "
     "e la funzione bulk_action() in ticket_service.py. Verifica anche il componente TicketList.jsx "
     "per la gestione della selezione e l'invio della richiesta."),

    # ── Dettaglio ticket ──────────────────────────────────────────────────────
    ("TCKT-0010", "tickets", "Notifica cambio stato non arriva all'autore del ticket",
     "Il test notifica cambio stato ha fallito: dopo aver cambiato lo stato di un ticket l'autore "
     "non riceve la notifica in-app. Controlla update_status() in ticket_service.py — verifica che "
     "notification_service.push() venga chiamato dopo il commit con il creator.id corretto "
     "e che il secondo 'await db.commit()' sia presente per salvare la notifica."),

    ("TCKT-0011", "tickets", "Pulsante Prendi in carico non funziona",
     "Il test 'prendi in carico' ha fallito: il pulsante non appare o l'azione restituisce errore. "
     "Controlla l'endpoint POST /api/tickets/{ticket_id}/take in routers/tickets/tickets.py "
     "e la funzione take_ticket() in ticket_service.py. Verifica che il campo taken_at venga "
     "valorizzato e che lo stato venga aggiornato a IN_PROGRESS."),

    ("TCKT-0012", "tickets", "Tempo di risoluzione non calcolato o errato nello storico",
     "Il test tempo risoluzione ha fallito: il campo resolution_minutes è nullo o errato nello storico. "
     "Controlla update_status() in ticket_service.py — verifica che il calcolo "
     "'delta = now - ticket.taken_at' avvenga solo quando taken_at è valorizzato "
     "e che resolution_minutes = int(delta.total_seconds() // 60) sia corretto."),

    ("TCKT-0013", "tickets", "Commento pubblico non salvato o notifica mancante",
     "Il test commento pubblico ha fallito: il commento non viene salvato oppure l'assegnatario "
     "non riceve la notifica in-app. Controlla add_comment() in services/tickets/comment_service.py — "
     "verifica il salvataggio del TicketComment e il blocco notifiche per il caso 'autore non manager "
     "commenta su ticket con assegnatario'. Controlla che 'await db.commit()' sia presente dopo push()."),

    ("TCKT-0014", "tickets", "Note interne visibili agli utenti STORE",
     "Il test note interne ha fallito: le note interne (is_internal=True) sono visibili agli utenti STORE "
     "oppure non si possono creare come manager. Controlla get_comments() in comment_service.py — "
     "verifica il filtro 'stmt.where(TicketComment.is_internal == False)' per gli utenti non manager. "
     "Controlla anche che il flag is_internal venga impostato correttamente in add_comment()."),

    ("TCKT-0015", "tickets", "Upload allegato fallisce",
     "Il test upload allegato ha fallito. Controlla l'endpoint POST /api/tickets/{id}/attachments "
     "in routers/tickets/tickets.py — verifica ALLOWED_MIME, MAX_FILE_SIZE (5MB) e il path "
     "TICKET_ATTACHMENTS_PATH nelle variabili d'ambiente (docker-compose.yml o .env). "
     "Controlla che la directory /data/attachments esista e sia scrivibile nel container backend."),

    # ── Storico ───────────────────────────────────────────────────────────────
    ("TCKT-0016", "tickets", "Storico ticket restituisce 422 o 500",
     "Il test storico ticket ha fallito con errore HTTP. Controlla l'ordine delle route in "
     "routers/tickets/tickets.py — la route GET '/history' deve essere definita PRIMA della route "
     "GET '/{ticket_id}', altrimenti FastAPI cattura 'history' come UUID e restituisce 422. "
     "Controlla anche get_history() in ticket_service.py — verifica che il filtro usi "
     "cast(Ticket.status, String) == 'closed' invece di Ticket.status == TicketStatus.CLOSED."),

    ("TCKT-0017", "tickets", "Filtri dello storico non funzionano",
     "Il test filtri storico ha fallito: i filtri per priorità o categoria non aggiornano la lista. "
     "Controlla i parametri query nell'endpoint GET /api/tickets/history in routers/tickets/tickets.py "
     "e i filtri corrispondenti in ticket_service.py → get_history(). "
     "Verifica anche la chiamata ticketsApi.history(params) in frontend/src/api/tickets.js."),

    # ── Notifiche ─────────────────────────────────────────────────────────────
    ("TCKT-0018", "tickets", "Badge campanella non appare o non si aggiorna",
     "Il test badge notifiche ha fallito: il badge numerico sulla campanella non compare o non si aggiorna "
     "ogni 30 secondi. Controlla il componente NotificationPanel.jsx in frontend/src/components/shared/ — "
     "verifica refetchInterval (deve essere 30000) e che l'endpoint GET /api/notifications risponda 200. "
     "Verifica anche che il model Notification sia importato in backend/app/main.py."),

    ("TCKT-0019", "tickets", "Pannello notifiche vuoto o non si apre",
     "Il test pannello notifiche ha fallito: il pannello non si apre o appare vuoto nonostante ci siano "
     "notifiche. Controlla NotificationPanel.jsx — verifica che notificationsApi.list() chiami "
     "GET /api/notifications e che la risposta contenga il campo 'notifications[]' e 'unread_count'. "
     "Controlla l'endpoint in routers/notifications.py e che il router sia registrato in main.py."),

    ("TCKT-0020", "tickets", "Click su notifica non naviga al ticket o non marca come letta",
     "Il test click notifica ha fallito. Controlla handleNotifClick() in NotificationPanel.jsx — "
     "verifica che notif.ticket_id sia presente nella risposta dell'API e che la navigazione usi "
     "navigate('/tickets/' + notif.ticket_id). Verifica anche che la chiamata "
     "POST /api/notifications/{id}/read funzioni e che il router mark_read in routers/notifications.py "
     "effettui il commit."),

    ("TCKT-0021", "tickets", "Segna tutte lette non funziona o badge non si azzera",
     "Il test 'segna tutte lette' ha fallito: il pulsante non produce effetto o il badge rimane. "
     "Controlla il componente NotificationPanel.jsx — verifica la mutazione markAllRead() e che chiami "
     "POST /api/notifications/read-all. Verifica l'endpoint mark_all_read in routers/notifications.py. "
     "Controlla anche il useEffect che chiama navigator.clearAppBadge() quando unreadCount == 0."),

    # ── PWA ───────────────────────────────────────────────────────────────────
    ("TCKT-0022", "pwa", "Manifest PWA non caricato o icone mancanti",
     "Il test PWA manifest ha fallito: il manifest non è caricato o le icone risultano 404. "
     "Controlla che frontend/public/manifest.json esista e che index.html contenga "
     "<link rel='manifest' href='/manifest.json'>. Verifica che i file icon-192.png e icon-512.png "
     "siano presenti in frontend/public/icons/. Ricostruisci il frontend con 'docker compose up -d --build frontend'."),

    ("TCKT-0023", "pwa", "Opzione Installa non disponibile in Edge",
     "Il test installazione PWA ha fallito: l'opzione 'Installa' non appare nel menu Edge. "
     "Controlla che manifest.json abbia display: 'standalone' e start_url: '/'. "
     "Verifica che la webapp sia servita su HTTPS o localhost (requisito per l'installabilità PWA). "
     "Assicurati che le icone siano presenti e valide — Edge richiede almeno un'icona 192x192."),

    ("TCKT-0024", "pwa", "Badge numerico non appare sull'icona nella taskbar",
     "Il test badge taskbar PWA ha fallito: l'icona FTC HUB nella taskbar non mostra il numero. "
     "Controlla il useEffect in NotificationPanel.jsx che chiama navigator.setAppBadge(unreadCount) — "
     "verifica che unreadCount > 0 e che non ci siano errori in console. "
     "Nota: l'API Badge funziona solo su Edge e Chrome installati come PWA su Windows. "
     "Verifica che l'app sia aperta come PWA installata e non come tab normale del browser."),
]


def upgrade() -> None:
    op.create_table(
        "support_error_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="auth",
    )
    op.create_index("ix_support_error_codes_code", "support_error_codes", ["code"], schema="auth")

    conn = op.get_bind()
    for code, module, description, prompt in CODES:
        conn.execute(
            sa.text(
                "INSERT INTO auth.support_error_codes (id, code, module, description, prompt) "
                "VALUES (:id, :code, :module, :description, :prompt)"
            ),
            {"id": str(uuid.uuid4()), "code": code, "module": module,
             "description": description, "prompt": prompt}
        )


def downgrade() -> None:
    op.drop_index("ix_support_error_codes_code", table_name="support_error_codes", schema="auth")
    op.drop_table("support_error_codes", schema="auth")
