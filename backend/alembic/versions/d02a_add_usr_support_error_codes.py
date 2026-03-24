"""add USR support error codes for user management tests

Revision ID: d02a
Revises: d01a
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa
import uuid

revision = "d02a"
down_revision = "d01a"
branch_labels = None
depends_on = None

CODES = [
    # ── Login ────────────────────────────────────────────────────────────────
    ("USR-0001", "users", "Login con credenziali ADMIN/IT valide non funziona",
     "Il test di login con utente ADMIN/IT ha fallito. Controlla l'endpoint POST /api/auth/login in "
     "routers/auth.py — verifica che authenticate_user() in core/security.py confronti correttamente "
     "username e password con verify_password(). Controlla che l'utente abbia is_active=True nel DB "
     "e che il campo 'department' sia valorizzato. Verifica i log backend con 'docker compose logs -f backend'."),

    ("USR-0002", "users", "Errore login con password sbagliata non generico o rivela dettagli",
     "Il test credenziali errate ha fallito: il messaggio di errore rivela se è lo username o la password "
     "ad essere sbagliato. Controlla authenticate_user() in backend/app/core/security.py — "
     "l'HTTPException in caso di credenziali errate deve restituire sempre lo stesso messaggio generico "
     "'Credenziali non valide' sia per username inesistente che per password sbagliata."),

    ("USR-0003", "users", "Login con username inesistente rivela che l'utente non esiste",
     "Il test username inesistente ha fallito: il sistema distingue tra 'utente non trovato' e 'password errata'. "
     "Controlla authenticate_user() in backend/app/core/security.py — deve restituire lo stesso errore "
     "generico sia se l'utente non esiste sia se la password è sbagliata. "
     "Verifica che non vengano esposti dettagli nel campo 'detail' dell'HTTPException."),

    ("USR-0004", "users", "Login con account disattivato non viene bloccato",
     "Il test account disattivato ha fallito: un utente con is_active=False riesce ad accedere. "
     "Controlla authenticate_user() in backend/app/core/security.py — verifica che dopo aver trovato "
     "l'utente venga controllato il campo is_active e sollevata HTTPException 400 se False. "
     "Verifica anche il DB: SELECT is_active FROM auth.users WHERE username='...';"),

    ("USR-0005", "users", "Login con username contenente spazi non funziona",
     "Il test username con spazi ha fallito. Controlla che il form di login non esegua trim() o replace() "
     "sullo username prima di inviarlo all'API. Verifica in authenticate_user() che la query SQLAlchemy "
     "cerchi lo username esatto: select(User).where(User.username == username). "
     "Se l'utente esiste nel DB con spazi, il login deve funzionare."),

    ("USR-0006", "users", "Sessione non persistente dopo chiusura browser",
     "Il test persistenza sessione ha fallito: dopo chiusura e riapertura del browser l'utente deve rifare "
     "il login. Controlla authStore.js in frontend/src/store/ — verifica che il token JWT e il refresh "
     "token vengano salvati in localStorage (non sessionStorage) per gli utenti non STOREMANAGER. "
     "Controlla che il refresh token venga usato automaticamente dal interceptor in api/client.js."),

    ("USR-0007", "users", "Logout non funziona o non invalida il token",
     "Il test logout ha fallito. Controlla il pulsante di logout nel componente Sidebar.jsx o Header — "
     "verifica che chiami authApi.logout() e poi authStore.logout() per pulire lo state. "
     "Controlla l'endpoint POST /api/auth/logout in routers/auth.py — deve invalidare il refresh token "
     "nel DB (tabella auth.refresh_tokens). Verifica che dopo logout la navigazione torni a /login."),

    ("USR-0008", "users", "Token precedente ancora valido dopo logout",
     "Il test invalidazione token post-logout ha fallito: il vecchio token permette ancora l'accesso. "
     "Controlla l'endpoint /api/auth/logout in routers/auth.py — verifica che il refresh token venga "
     "rimosso dalla tabella auth.refresh_tokens. Controlla anche che il componente ProtectedRoute.jsx "
     "in frontend/src/routes/ verifichi il token ad ogni navigazione e reindirizzi a /login se mancante."),

    ("USR-0009", "users", "Utente HO vede la voce Gestione Utenti nel menu",
     "Il test visibilità menu per HO ha fallito: la voce Gestione Utenti è visibile a un utente HO. "
     "Controlla Sidebar.jsx in frontend/src/components/layout/ — verifica che la voce Admin/Gestione Utenti "
     "sia renderizzata solo se hasRole('ADMIN') o user?.department === 'IT'. "
     "Controlla anche RoleRoute.jsx — solo ADMIN può accedere alle route /admin/*."),

    ("USR-0010", "users", "Utente STORE vede la voce Gestione Utenti nel menu",
     "Il test visibilità menu per STORE ha fallito: la voce Gestione Utenti è visibile a un utente STORE. "
     "Controlla Sidebar.jsx in frontend/src/components/layout/ — la voce deve essere nascosta per "
     "role STORE e STOREMANAGER. Verifica user?.role e user?.department nel componente. "
     "Controlla anche che la route /admin sia protetta da RoleRoute con roles=['ADMIN']."),

    # ── Creazione utente ─────────────────────────────────────────────────────
    ("USR-0011", "users", "Creazione utente con dati validi fallisce",
     "Il test creazione utente base ha fallito. Controlla l'endpoint POST /api/admin/users in "
     "routers/admin/users.py — verifica che lo schema CreateUserRequest accetti tutti i campi. "
     "Controlla create_user() per eventuali errori di validazione Pydantic o vincoli DB. "
     "Esegui 'docker compose logs -f backend' subito dopo il tentativo per vedere l'errore esatto."),

    ("USR-0012", "users", "Form creazione utente accetta username vuoto",
     "Il test campo username obbligatorio ha fallito: il form viene inviato senza username. "
     "Controlla la validazione frontend in AdminUsers.jsx — verifica che il campo username abbia "
     "required=True nel form. Controlla anche lo schema Pydantic CreateUserRequest in "
     "backend/app/routers/admin/users.py — username non deve essere Optional."),

    ("USR-0013", "users", "Form creazione utente accetta password vuota",
     "Il test campo password obbligatorio ha fallito: il form viene inviato senza password. "
     "Controlla la validazione in AdminUsers.jsx — il campo password deve avere required=True. "
     "Controlla lo schema Pydantic CreateUserRequest — password non deve essere Optional. "
     "Verifica anche che il backend ritorni 422 se password è assente."),

    ("USR-0014", "users", "Creazione utente con username duplicato non restituisce errore",
     "Il test username duplicato ha fallito: l'utente viene creato anche se lo username esiste già. "
     "Controlla create_user() in routers/admin/users.py — deve eseguire una SELECT prima dell'INSERT "
     "per verificare che username non esista già. Controlla anche che la tabella auth.users abbia "
     "un vincolo UNIQUE su username (verifica con \\d auth.users nel DB)."),

    ("USR-0015", "users", "Creazione utente con email duplicata non restituisce errore",
     "Il test email duplicata ha fallito: l'utente viene creato anche se l'email esiste già. "
     "Controlla create_user() in routers/admin/users.py — deve verificare che l'email non sia già in uso. "
     "Controlla che la tabella auth.users abbia un vincolo UNIQUE su email. "
     "Verifica con: SELECT COUNT(*) FROM auth.users WHERE email='email_in_questione';"),

    ("USR-0016", "users", "Email in formato non valido accettata in fase di creazione",
     "Il test validazione formato email ha fallito: un'email malformata viene accettata. "
     "Controlla lo schema Pydantic CreateUserRequest in routers/admin/users.py — "
     "usa EmailStr di pydantic per la validazione automatica del formato email. "
     "Controlla anche la validazione frontend in AdminUsers.jsx."),

    ("USR-0017", "users", "Ruolo non valido accettato in fase di creazione",
     "Il test ruolo non valido ha fallito: un ruolo non previsto viene accettato. "
     "Controlla lo schema CreateUserRequest — il campo role deve essere tipizzato come UserRole enum "
     "(valori: ADMIN, HO, DM, STORE). Pydantic rifiuterà automaticamente valori non nell'enum. "
     "Controlla anche la select nel form AdminUsers.jsx — deve mostrare solo i valori dell'enum."),

    ("USR-0018", "users", "Ruolo STORE con department HR non viene bloccato",
     "Il test compatibilità ruolo/department STORE-HR ha fallito. "
     "Controlla create_user() in routers/admin/users.py — deve validare che role=STORE ammetta "
     "solo department STORE o STOREMANAGER. Aggiungi una validazione esplicita prima del salvataggio: "
     "if data.role == UserRole.STORE and data.department not in (UserDepartment.STORE, UserDepartment.STOREMANAGER): raise HTTPException(400)."),

    ("USR-0019", "users", "Ruolo DM con department FINANCE non viene bloccato",
     "Il test compatibilità ruolo/department DM-FINANCE ha fallito. "
     "Controlla create_user() in routers/admin/users.py — deve validare che role=DM ammetta "
     "solo department DM. Aggiungi: "
     "if data.role == UserRole.DM and data.department != UserDepartment.DM: raise HTTPException(400, 'Per ruolo DM il department deve essere DM')."),

    ("USR-0020", "users", "Ruolo HO con department STOREMANAGER non viene bloccato",
     "Il test compatibilità ruolo/department HO-STOREMANAGER ha fallito. "
     "Controlla create_user() in routers/admin/users.py — deve validare che role=HO ammetta "
     "solo department IT, MANAGER, HR, FINANCE, MARKETING, COMMERCIAL, RETAIL, FACILITIES, TOPMGR. "
     "Aggiungi validazione esplicita e lancia HTTPException(400) se department non è in quella lista."),

    ("USR-0021", "users", "Creazione utente STORE con codice negozio valido fallisce",
     "Il test creazione utente STORE con username codice negozio ha fallito. "
     "Controlla create_user() in routers/admin/users.py — verifica che non ci sia una validazione "
     "che blocca username in formato ITXXX. Controlla i log del backend per l'errore esatto. "
     "Verifica che il pattern regex per validare username STORE sia corretto: r'^IT\\d{3,5}$'."),

    ("USR-0022", "users", "Utente STORE creato con username non conforme al formato negozio",
     "Il test validazione username STORE ha fallito: viene creato un utente STORE con username non valido. "
     "Controlla create_user() in routers/admin/users.py — deve validare che per role=STORE "
     "lo username sia nel formato ITXXX (es. IT207). Aggiungi: "
     "if data.role == UserRole.STORE and not re.match(r'^IT\\d{3,5}$', data.username): raise HTTPException(400)."),

    ("USR-0023", "users", "Utente HO riesce ad accedere alla pagina di creazione utente",
     "Il test accesso non autorizzato creazione utente ha fallito: un utente HO accede alla funzione. "
     "Controlla il router POST /api/admin/users in routers/admin/users.py — deve avere "
     "Depends(require_permission('users.manage')) o un controllo esplicito su department IT/ADMIN. "
     "Controlla anche RoleRoute.jsx nel frontend — la route /admin deve essere protetta."),

    ("USR-0024", "users", "Form creazione utente accetta nome completo vuoto",
     "Il test campo nome completo obbligatorio ha fallito. "
     "Controlla la validazione frontend in AdminUsers.jsx — il campo full_name deve essere required. "
     "Controlla lo schema Pydantic CreateUserRequest — full_name non deve essere Optional o deve "
     "avere un validator che rifiuta stringhe vuote: @validator('full_name') def not_empty..."),

    # ── Modifica utente ──────────────────────────────────────────────────────
    ("USR-0025", "users", "Modifica nome completo non funziona o non si salva",
     "Il test modifica nome completo ha fallito. Controlla l'endpoint PATCH o PUT per la modifica utente "
     "in routers/admin/users.py — verifica che il campo full_name venga aggiornato nel DB. "
     "Controlla che il componente AdminUsers.jsx chiami correttamente authApi.updateUser() "
     "e che React Query invalidi la query dopo la mutazione (invalidateQueries)."),

    ("USR-0026", "users", "Modifica email non funziona",
     "Il test modifica email ha fallito. Controlla l'endpoint di modifica in routers/admin/users.py — "
     "verifica che il campo email venga aggiornato. Controlla che la nuova email venga validata "
     "(formato EmailStr) e che non sia già in uso da un altro utente prima del salvataggio."),

    ("USR-0027", "users", "Modifica telefono non funziona",
     "Il test modifica telefono ha fallito. Controlla l'endpoint di modifica in routers/admin/users.py "
     "e verifica che il campo phone venga aggiornato nel DB. Verifica con: "
     "SELECT phone FROM auth.users WHERE username='...'; dopo la modifica."),

    ("USR-0028", "users", "Cambio ruolo utente non aggiorna il department compatibile",
     "Il test cambio ruolo ha fallito: dopo il cambio ruolo il department rimane incompatibile. "
     "Controlla l'endpoint di modifica ruolo in routers/admin/users.py (change_department o update_user) — "
     "deve includere logica per aggiornare automaticamente il department o richiedere all'utente "
     "di selezionarne uno compatibile. Controlla anche il frontend in AdminUsers.jsx."),

    ("USR-0029", "users", "Modifica department non funziona o non si salva",
     "Il test modifica department ha fallito. Controlla l'endpoint PATCH /api/admin/users/{id}/department "
     "in routers/admin/users.py — verifica che ChangeDepartmentRequest venga processato correttamente "
     "e che il campo department venga aggiornato nel DB con il nuovo valore enum."),

    ("USR-0030", "users", "Reset password da admin non funziona",
     "Il test reset password da admin ha fallito. Controlla l'endpoint di modifica password in "
     "routers/admin/users.py — deve chiamare get_password_hash() da core/security.py e salvare "
     "l'hash aggiornato in hashed_password. Verifica che il nuovo hash sia un bcrypt valido "
     "($2b$12$...) con: SELECT LEFT(hashed_password, 7) FROM auth.users WHERE username='...';"),

    ("USR-0031", "users", "Utente HO riesce a modificare altri utenti",
     "Il test accesso non autorizzato modifica utente ha fallito. "
     "Controlla che ogni endpoint di modifica in routers/admin/users.py abbia il controllo "
     "del department: if getattr(current_user, 'department', None) not in (UserDepartment.IT, UserDepartment.ADMIN): raise HTTPException(403). "
     "Controlla anche che il frontend nasconda i controlli di modifica agli utenti non autorizzati."),

    ("USR-0032", "users", "ADMIN/IT può modificare utente con department superiore",
     "Il test protezione department superiore ha fallito: un utente IT riesce a modificare un utente TOPMGR. "
     "Controlla l'endpoint di modifica in routers/admin/users.py — aggiungi una gerarchia di department "
     "e verifica che current_user non possa modificare utenti con department di livello superiore. "
     "Definisci DEPARTMENT_LEVEL = {IT: 1, MANAGER: 2, ..., TOPMGR: 5} e confronta i livelli."),

    ("USR-0033", "users", "Modifica email con valore duplicato non restituisce errore",
     "Il test email duplicata in modifica ha fallito. Controlla l'endpoint di modifica in "
     "routers/admin/users.py — prima di aggiornare l'email verifica che non sia già usata da "
     "un altro utente: SELECT id FROM auth.users WHERE email=? AND id != user_id. "
     "Se trovata, lancia HTTPException(400, 'Email già in uso')."),

    ("USR-0034", "users", "Ruolo DM con department FINANCE accettato in modifica",
     "Il test compatibilità ruolo/department in modifica ha fallito. "
     "Controlla l'endpoint di modifica in routers/admin/users.py — la stessa validazione ruolo/department "
     "applicata in creazione deve essere presente anche in modifica. "
     "Verifica che sia presente il controllo: role=DM → department deve essere solo DM."),

    # ── Disattivazione e riattivazione ───────────────────────────────────────
    ("USR-0035", "users", "Disattivazione utente non funziona",
     "Il test disattivazione utente ha fallito. Controlla l'endpoint di disattivazione in "
     "routers/admin/users.py — deve impostare user.is_active = False e fare commit. "
     "Verifica con: SELECT is_active FROM auth.users WHERE username='...'; "
     "Controlla che React Query invalidi la lista utenti dopo l'operazione."),

    ("USR-0036", "users", "Utente disattivato riesce ancora ad accedere",
     "Il test login utente disattivato ha fallito: l'utente con is_active=False riesce ad entrare. "
     "Controlla authenticate_user() in backend/app/core/security.py — deve verificare "
     "user.is_active subito dopo aver trovato l'utente e prima di verificare la password. "
     "Verifica anche get_current_user() in core/dependencies.py — deve controllare is_active sul token."),

    ("USR-0037", "users", "Riattivazione utente non funziona",
     "Il test riattivazione utente ha fallito. Controlla l'endpoint di riattivazione in "
     "routers/admin/users.py — deve impostare user.is_active = True e fare commit. "
     "Verifica con: SELECT is_active FROM auth.users WHERE username='...'; "
     "Controlla anche che la lista utenti si aggiorni correttamente."),

    ("USR-0038", "users", "Login non funziona dopo riattivazione",
     "Il test login post-riattivazione ha fallito. Verifica prima che is_active sia True nel DB: "
     "SELECT is_active FROM auth.users WHERE username='...'; "
     "Se is_active=True ma il login fallisce ancora, controlla che non ci siano cache del token "
     "precedente. Prova il login da una finestra in incognito."),

    ("USR-0039", "users", "Utente HO riesce a disattivare altri utenti",
     "Il test accesso non autorizzato disattivazione ha fallito. "
     "Controlla l'endpoint di disattivazione in routers/admin/users.py — deve verificare "
     "che current_user.department sia IT o ADMIN prima di procedere. "
     "Aggiungi: if getattr(current_user, 'department') not in (UserDepartment.IT, ...): raise HTTPException(403)."),

    ("USR-0040", "users", "Utente riesce a disattivare il proprio account",
     "Il test auto-disattivazione ha fallito: l'utente può disattivare se stesso. "
     "Controlla l'endpoint di disattivazione in routers/admin/users.py — aggiungi il controllo: "
     "if user_id == current_user.id: raise HTTPException(400, 'Non puoi disattivare il tuo stesso account'). "
     "Aggiungi la stessa protezione anche nel frontend in AdminUsers.jsx."),

    ("USR-0041", "users", "Utente disattivato appare nella lista predefinita",
     "Il test visibilità utenti disattivati ha fallito: utenti con is_active=False compaiono nella lista. "
     "Controlla list_users() in routers/admin/users.py — la query deve filtrare per is_active=True "
     "di default: stmt = select(User).where(User.is_active == True). "
     "Aggiungi un parametro opzionale include_inactive per mostrarli solo su richiesta esplicita."),

    # ── Profilo personale ────────────────────────────────────────────────────
    ("USR-0042", "users", "Pagina profilo personale non carica o mostra dati errati",
     "Il test visualizzazione profilo ha fallito. Controlla l'endpoint GET /api/auth/me o /api/profile "
     "in routers/auth.py — deve restituire username, full_name, email, phone, role, department. "
     "Controlla ProfilePage.jsx in frontend/src/pages/ — verifica che la query useQuery chiami "
     "l'endpoint corretto e che i campi visualizzati corrispondano alla risposta API."),

    ("USR-0043", "users", "Modifica nome completo dal profilo personale non funziona",
     "Il test modifica nome dal profilo ha fallito. Controlla l'endpoint PATCH /api/profile o "
     "/api/auth/me in routers/auth.py — deve aggiornare full_name nel DB. "
     "Controlla ProfilePage.jsx — verifica la mutazione useMutation e che chiami l'endpoint corretto. "
     "Verifica che React Query invalidi la query profilo dopo la mutazione."),

    ("USR-0044", "users", "Modifica email dal profilo personale non funziona",
     "Il test modifica email dal profilo ha fallito. Controlla l'endpoint di aggiornamento profilo "
     "in routers/auth.py — deve aggiornare il campo email. Verifica che l'email venga validata "
     "(formato EmailStr) e che non sia già in uso da un altro utente."),

    ("USR-0045", "users", "Modifica telefono dal profilo personale non funziona",
     "Il test modifica telefono dal profilo ha fallito. Controlla l'endpoint di aggiornamento profilo "
     "in routers/auth.py — deve aggiornare il campo phone nel DB. "
     "Verifica con: SELECT phone FROM auth.users WHERE id='...' dopo la modifica."),

    ("USR-0046", "users", "Cambio password con vecchia password sbagliata viene accettato",
     "Il test validazione vecchia password ha fallito: la password viene cambiata anche con vecchia "
     "password errata. Controlla l'endpoint POST /api/auth/change-password in routers/auth.py — "
     "deve chiamare verify_password(old_password, user.hashed_password) e lanciare "
     "HTTPException(400) se il risultato è False."),

    ("USR-0047", "users", "Cambio password corretto non funziona",
     "Il test cambio password ha fallito. Controlla l'endpoint POST /api/auth/change-password — "
     "deve: 1) verificare la vecchia password, 2) hashare la nuova con get_password_hash(), "
     "3) aggiornare hashed_password nel DB, 4) invalidare i refresh token esistenti. "
     "Verifica che l'hash salvato inizi con '$2b$': SELECT LEFT(hashed_password,4) FROM auth.users WHERE id='...';"),

    ("USR-0048", "users", "Utente riesce a modificare il proprio ruolo dal profilo",
     "Il test sola lettura del ruolo ha fallito: il campo ruolo è modificabile dall'utente. "
     "Controlla ProfilePage.jsx — il campo role deve essere <span> o <input readOnly>, non una <select>. "
     "Controlla anche l'endpoint di aggiornamento profilo in routers/auth.py — "
     "il campo role deve essere escluso dallo schema di aggiornamento profilo (non presente in ProfileUpdateRequest)."),

    ("USR-0049", "users", "Utente riesce a modificare il proprio department dal profilo",
     "Il test sola lettura del department ha fallito: il campo department è modificabile dall'utente. "
     "Controlla ProfilePage.jsx — il campo department deve essere in sola lettura. "
     "Controlla l'endpoint di aggiornamento profilo — department non deve essere presente in "
     "ProfileUpdateRequest. Solo gli admin possono cambiare department tramite il pannello di gestione."),

    # ── Lista e ricerca utenti ───────────────────────────────────────────────
    ("USR-0050", "users", "Lista utenti mostra utenti disattivati o non carica",
     "Il test lista utenti predefinita ha fallito. Controlla list_users() in routers/admin/users.py — "
     "la query deve includere WHERE is_active = TRUE di default. "
     "Controlla anche AdminUsers.jsx — la chiamata API deve non passare include_inactive=true. "
     "Verifica con: SELECT COUNT(*) FROM auth.users WHERE is_active=true;"),

    ("USR-0051", "users", "Filtro per ruolo nella lista utenti non funziona",
     "Il test filtro ruolo ha fallito. Controlla list_users() in routers/admin/users.py — "
     "il parametro role (Query param) deve aggiungere: stmt = stmt.where(User.role == role). "
     "Controlla AdminUsers.jsx — verifica che il filtro passi il parametro role nella query string "
     "e che useQuery abbia role nella queryKey per triggerare il refetch al cambio."),

    ("USR-0052", "users", "Filtro per department nella lista utenti non funziona",
     "Il test filtro department ha fallito. Controlla list_users() in routers/admin/users.py — "
     "il parametro department deve aggiungere: stmt = stmt.where(User.department == department). "
     "Controlla AdminUsers.jsx — verifica che il cambio del filtro department chiami il refetch "
     "e che il valore sia nella queryKey."),

    ("USR-0053", "users", "Ricerca per username nella lista utenti non funziona",
     "Il test ricerca per username ha fallito. Controlla list_users() in routers/admin/users.py — "
     "il parametro search deve aggiungere: stmt = stmt.where(User.username.ilike(f'%{search}%')). "
     "Controlla AdminUsers.jsx — verifica che il campo di ricerca passi il valore al parametro "
     "search nella query e che scatti il refetch ad ogni modifica."),

    ("USR-0054", "users", "Ricerca per nome completo nella lista utenti non funziona",
     "Il test ricerca per nome ha fallito. Controlla list_users() in routers/admin/users.py — "
     "il filtro di ricerca deve includere sia username che full_name con OR: "
     "stmt.where(or_(User.username.ilike('%s%'), User.full_name.ilike('%s%'))). "
     "Controlla AdminUsers.jsx — verifica che la ricerca testuale cerchi su entrambi i campi."),

    ("USR-0055", "users", "Toggle mostra utenti disattivati non funziona",
     "Il test visibilità utenti disattivati ha fallito. Controlla list_users() in routers/admin/users.py — "
     "deve accettare un parametro include_inactive: bool = False e aggiungere il filtro "
     "is_active=True solo se include_inactive=False. "
     "Controlla AdminUsers.jsx — il toggle deve aggiornare la queryKey e passare include_inactive."),

    ("USR-0056", "users", "Utente DM accede alla lista utenti",
     "Il test accesso non autorizzato lista utenti ha fallito: un utente DM vede la lista. "
     "Controlla list_users() in routers/admin/users.py — deve avere il controllo: "
     "if getattr(current_user, 'department') not in (UserDepartment.IT, UserDepartment.ADMIN, UserDepartment.TOPMGR): "
     "raise HTTPException(403). Controlla anche il frontend — la route deve essere protetta."),

    ("USR-0057", "users", "Filtri combinati ruolo e ricerca non funzionano insieme",
     "Il test filtri combinati ha fallito: applicando ruolo e ricerca insieme la lista non è corretta. "
     "Controlla list_users() in routers/admin/users.py — i filtri devono essere cumulativi (AND). "
     "Verifica che ogni filtro aggiunga un .where() alla stessa stmt, non sostituisca la query. "
     "Esempio: if role: stmt = stmt.where(User.role == role); if search: stmt = stmt.where(...)."),

    # ── Permessi e accessi ───────────────────────────────────────────────────
    ("USR-0058", "users", "Gestione Utenti non visibile per ADMIN/IT",
     "Il test visibilità Gestione Utenti per ADMIN/IT ha fallito. "
     "Controlla Sidebar.jsx in frontend/src/components/layout/ — la voce Gestione Utenti deve "
     "essere visibile quando hasRole('ADMIN') === true o user?.department === 'IT'. "
     "Verifica che authStore restituisca correttamente role e department dopo il login."),

    ("USR-0059", "users", "Gestione Utenti visibile per utente HO",
     "Il test nascondere Gestione Utenti per HO ha fallito. "
     "Controlla Sidebar.jsx — la condizione di visibilità deve escludere role=HO. "
     "Verifica che user?.role sia 'HO' e non 'ADMIN' per quell'utente. "
     "Controlla il DB: SELECT role, department FROM auth.users WHERE username='...'"),

    ("USR-0060", "users", "Gestione Utenti visibile per utente DM",
     "Il test nascondere Gestione Utenti per DM ha fallito. "
     "Controlla Sidebar.jsx — la condizione di visibilità deve escludere role=DM. "
     "Verifica che user?.role sia 'DM' per quell'utente nel DB."),

    ("USR-0061", "users", "Gestione Utenti visibile per utente STORE",
     "Il test nascondere Gestione Utenti per STORE ha fallito. "
     "Controlla Sidebar.jsx — la condizione di visibilità deve escludere role=STORE e department=STOREMANAGER. "
     "Verifica nel DB: SELECT role, department FROM auth.users WHERE username='...';"),

    ("USR-0062", "users", "ADMIN non riesce a modificare department di un altro ADMIN",
     "Il test modifica department ADMIN-ADMIN ha fallito: l'operazione viene bloccata anche quando "
     "dovrebbe essere consentita. Controlla l'endpoint di modifica department in routers/admin/users.py — "
     "la regola deve essere: un ADMIN può modificare un altro ADMIN se il department target non è "
     "superiore al suo. Verifica la logica di confronto dei livelli department."),

    ("USR-0063", "users", "API /api/admin/users accessibile senza autenticazione",
     "Il test accesso senza token ha fallito: l'endpoint risponde senza JWT. "
     "Controlla che ogni endpoint in routers/admin/users.py abbia "
     "Depends(get_current_user) come dipendenza. "
     "Verifica che get_current_user() in core/dependencies.py lanci HTTPException(401) "
     "se il token Authorization è assente o malformato."),

    ("USR-0064", "users", "Token scaduto non viene rifiutato o non reindirizza al login",
     "Il test token scaduto ha fallito. Controlla get_current_user() in core/dependencies.py — "
     "deve catturare JWTError e sollevare HTTPException(401, 'Token scaduto'). "
     "Controlla api/client.js nel frontend — l'interceptor di risposta deve intercettare 401 "
     "e tentare il refresh token. Se anche il refresh è scaduto, deve chiamare authStore.logout() "
     "e reindirizzare a /login."),

    ("USR-0065", "users", "Utente STORE accede all'endpoint /api/admin/users",
     "Il test accesso non autorizzato endpoint admin ha fallito: un utente STORE ottiene dati. "
     "Controlla list_users() in routers/admin/users.py — deve avere il controllo del department "
     "o usare Depends(require_permission('users.view')). "
     "Verifica che require_permission() in core/dependencies.py blocchi correttamente "
     "gli utenti con role=STORE."),

    ("USR-0066", "users", "ADMIN/IT assegna department TOPMGR a utente HO",
     "Il test protezione escalation department ha fallito: un utente IT riesce ad assegnare TOPMGR. "
     "Controlla l'endpoint di cambio department in routers/admin/users.py — aggiungi una gerarchia: "
     "DEPARTMENT_LEVEL = {'IT': 1, 'MANAGER': 2, 'HR': 2, ..., 'TOPMGR': 5, 'ADMIN': 5} "
     "e verifica: if DEPARTMENT_LEVEL[new_dept] > DEPARTMENT_LEVEL[current_user.department]: raise HTTPException(403)."),
]


def upgrade() -> None:
    conn = op.get_bind()
    for code, module, description, prompt in CODES:
        conn.execute(
            sa.text(
                "INSERT INTO auth.support_error_codes (id, code, module, description, prompt) "
                "VALUES (:id, :code, :module, :description, :prompt) "
                "ON CONFLICT (code) DO NOTHING"
            ),
            {"id": str(uuid.uuid4()), "code": code, "module": module,
             "description": description, "prompt": prompt}
        )


def downgrade() -> None:
    conn = op.get_bind()
    codes = [c[0] for c in CODES]
    conn.execute(
        sa.text("DELETE FROM auth.support_error_codes WHERE code = ANY(:codes)"),
        {"codes": codes}
    )
