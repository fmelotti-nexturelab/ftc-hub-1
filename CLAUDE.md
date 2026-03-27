# CLAUDE.md — FTC HUB Project Rules

> Questo file è il contratto tra te (Claude Code) e il progetto FTC HUB.
> Leggilo SEMPRE prima di scrivere codice. Se una regola qui contraddice una tua assunzione, vince questa regola.

---

## 1. IDENTITÀ DEL PROGETTO

FTC HUB è la piattaforma operativa interna di **Flying Tiger Copenhagen** per gestire negozi (150+ store), suddivisi in entity (IT01, IT02, IT03). Gli utenti sono Head Office (HO), District Manager (DM) e Store. Il sistema è multi-entity, multi-store, multi-ruolo.

**NON è** un sito pubblico, un e-commerce, o un'app consumer. È un **gestionale enterprise interno**.

---

## 2. STACK TECNOLOGICO — Non cambiare mai

### Backend
- **Python 3.12** + **FastAPI**
- **SQLAlchemy async** (asyncpg) — NO sync, NO raw SQL nei router
- **PostgreSQL 16** con schema separati (`auth`, `ho`, e futuri)
- **Alembic** per TUTTE le migrazioni — MAI `Base.metadata.create_all()`
- **JWT** (python-jose) + refresh token con hash SHA-256
- **Pydantic v2** per schemas (usa `model_config = ConfigDict(from_attributes=True)`)
- **Docker Compose** (backend + db + frontend)

### Frontend
- **React 18** + **Vite 5**
- **Tailwind CSS 3** (utility-first, NO CSS custom, NO styled-components, NO CSS modules)
- **Zustand** per state management globale (auth store)
- **TanStack React Query v5** per data fetching / caching
- **Axios** con interceptors per JWT auto-refresh
- **Radix UI** per componenti primitivi (Dialog, DropdownMenu, Tabs, Toast, Select, Tooltip)
- **Lucide React** per icone
- **clsx** + **tailwind-merge** + **class-variance-authority** per className condizionali
- **date-fns** per date
- **react-router-dom v6** per routing

### ⛔ NON usare MAI
- Material UI, Chakra UI, Ant Design, Bootstrap
- Redux, MobX, Recoil, Jotai
- SWR (usiamo React Query)
- Fetch API diretto (usiamo Axios via `apiClient`)
- CSS modules, SCSS, styled-components
- `create_all()` o DDL manuale nel codice Python
- Raw SQL nei router (solo nella service layer se necessario)
- Sync SQLAlchemy (tutto è async)

---

## 3. ARCHITETTURA BACKEND — Regole rigide

### Struttura cartelle
```
backend/app/
├── config.py              # Settings (pydantic-settings, singleton `settings`)
├── database.py            # Engine, AsyncSession, Base, get_db()
├── main.py                # FastAPI app, lifespan, middleware, router include
├── core/
│   ├── security.py        # JWT, bcrypt, Fernet (NAV passwords)
│   └── dependencies.py    # get_current_user, require_permission(), RBAC engine
├── models/                # SQLAlchemy ORM (1 file per dominio)
│   ├── auth.py
│   ├── ho.py
│   └── rbac_scope.py
├── schemas/               # Pydantic v2 (1 file per dominio, Request + Response)
│   ├── auth.py
│   └── ho.py
├── routers/               # FastAPI routers (thin layer, delega ai services)
│   ├── auth.py
│   └── ho/
│       └── sales.py
└── services/              # Business logic pura
    └── ho/
        └── sales.py
```

### Regole per nuovo modulo
Quando aggiungi un nuovo modulo (es. `inventory`):
1. Crea `models/inventory.py` — tabelle nello schema `ho` (o nuovo schema se indicato)
2. Crea `schemas/inventory.py` — Pydantic con `ConfigDict(from_attributes=True)`
3. Crea `services/inventory/` con logica business
4. Crea `routers/inventory/` con endpoint REST
5. Registra il router in `main.py` con `app.include_router(...)`
6. Crea migrazione Alembic: `alembic revision --autogenerate -m "descrizione"`
7. Importa i modelli in `main.py` per registrazione metadata

### Pattern obbligatori backend
- **Dependency injection** via `Depends()` — mai istanziare manualmente
- **RBAC** sempre: ogni endpoint DEVE avere `dependencies=[Depends(require_permission("modulo.azione"))]`
- **Permessi** nel formato `modulo.azione` (es: `sales.view`, `inventory.edit`, `stores.exclude_manage`)
- **Admin bypass**: `system.admin` con scope `GLOBAL` bypassa ogni controllo
- **Soft delete**: usa campo `is_active = Column(Boolean, default=True)`, MAI DELETE reale
- **UUID** come PK per tutte le tabelle: `Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`
- **Timezone-aware**: `DateTime(timezone=True)` + `server_default=func.now()`
- **Schema PostgreSQL**: ogni tabella DEVE avere `__table_args__ = {"schema": "auth"}` o `{"schema": "ho"}` ecc.
- **Enum** come `str, enum.Enum` per valori fissi

### Convenzioni naming backend
- File: `snake_case.py`
- Classi model: `PascalCase` (es: `ExcludedStore`, `SalesSession`)
- Tabelle DB: `snake_case` (es: `excluded_stores`, `nav_credentials`)
- Endpoint: `snake_case` con verb HTTP corretto
- Prefix router: `/api/{modulo}/{sotto-modulo}` (es: `/api/ho/sales`)
- Tags router: `["HO - Sales"]`, `["Auth"]` ecc.

---

## 4. ARCHITETTURA FRONTEND — Regole rigide

### Struttura cartelle
```
frontend/src/
├── api/                   # Funzioni API (1 file per dominio)
│   ├── client.js          # Axios instance + interceptors (NON TOCCARE)
│   ├── auth.js
│   └── ho/
│       └── sales.js
├── components/
│   ├── layout/            # Shell, Sidebar, Header (struttura app)
│   └── shared/            # Componenti riusabili (Button, Modal, Table, ecc.)
├── pages/                 # 1 pagina = 1 file JSX
│   ├── Login.jsx
│   ├── Unauthorized.jsx
│   └── ho/
│       ├── HODashboard.jsx
│       └── sales/
│           ├── SalesIT01.jsx
│           └── ExcludedStores.jsx
├── routes/
│   ├── ProtectedRoute.jsx  # Auth guard
│   └── RoleRoute.jsx       # Role guard
├── store/
│   └── authStore.js        # Zustand (unico store globale auth)
├── App.jsx                 # Route tree
├── main.jsx                # Entry point (React, QueryClient, BrowserRouter)
└── index.css               # Solo @tailwind directives
```

### Pattern obbligatori frontend
- **Ogni API call** passa per `apiClient` (da `api/client.js`) — MAI `axios` diretto o `fetch()`
- **API modules** come oggetti: `export const salesApi = { getX: () => apiClient.get(...), ... }`
- **Data fetching**: `useQuery` per GET, `useMutation` per POST/PUT/DELETE (TanStack React Query)
- **Auth state**: solo via `useAuthStore` (Zustand) — MAI React Context per auth
- **Routing protetto**: `<ProtectedRoute>` per auth, `<RoleRoute roles={[...]}>` per autorizzazione
- **Alias import**: usa `@/` per percorsi da `src/` (es: `import { salesApi } from "@/api/ho/sales"`)
- **Export default** per pagine e componenti layout
- **Export named** per hooks e utility

### Convenzioni naming frontend
- File componenti: `PascalCase.jsx` (es: `SalesIT01.jsx`, `ExcludedStores.jsx`)
- File utility/api/store: `camelCase.js` (es: `authStore.js`, `client.js`)
- Componenti: `PascalCase` (es: `function SalesTable()`)
- Hooks custom: `useCamelCase` (es: `useAuthStore`)
- Cartelle: `kebab-case` o `camelCase` (mai PascalCase per cartelle)
- API objects: `camelCaseApi` (es: `salesApi`, `authApi`)

---

## 5. DESIGN SYSTEM — Coerenza visiva

### Palette colori (Tailwind classes)
```
Primary:        bg-[#1e3a5f]     (sidebar, logo, bottoni primari, header title)
Primary hover:  bg-[#2563eb]     (hover su bottoni primari)
Sfondo app:     bg-gray-50
Card/pannello:  bg-white rounded-xl border border-gray-200 shadow-sm
Testo heading:  text-gray-800
Testo body:     text-gray-600 / text-gray-500
Testo muted:    text-gray-400
Errore bg:      bg-red-50 border-red-200 text-red-700
Warning bg:     bg-amber-50 border-amber-200 text-amber-700
Success bg:     bg-green-50 border-green-200 text-green-700
Tag entity:     bg-blue-100 text-blue-700 (IT01), bg-emerald-100 text-emerald-700 (IT02), bg-violet-100 text-violet-700 (IT03)
```

### Pattern UI comuni
- **Card container**: `bg-white rounded-xl border border-gray-200 p-5 shadow-sm`
- **Bottone primario**: `bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-6 rounded-xl shadow transition disabled:opacity-50`
- **Input**: `w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition`
- **Textarea code/data**: `text-xs font-mono bg-gray-50 border-2 border-blue-400 rounded-lg px-3 py-2`
- **Section title**: `text-xl font-bold text-gray-800 mb-6`
- **Badge/tag**: `text-xs font-bold px-2 py-0.5 rounded` + colori per entity
- **Badge "soon"**: `text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded`
- **Table header**: `bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs`
- **Table row striping**: `odd:bg-white even:bg-gray-50/50`
- **Data banner** (sopra tabella): `bg-blue-500 px-4 py-2 text-white font-bold` con statistiche a destra

### Sidebar
- Background: `bg-[#1e3a5f]`
- Width: `w-64`
- Logo: lettera "F" in `w-9 h-9 bg-white/10 rounded-lg`, font-black
- Sezioni: label uppercase `text-xs font-semibold text-white/40 tracking-wider`
- Link attivo: `bg-white/15 text-white font-medium`
- Link inattivo: `text-white/70 hover:bg-white/10`
- Submenu: indentato con `ml-4 border-l border-white/10 pl-3`
- User avatar: cerchio con iniziale, `bg-white/20 rounded-full`

### Icone
- Usa SOLO `lucide-react`
- Size standard: `size={17}` nella sidebar, `size={16}` nei bottoni, `size={22}` nelle card dashboard
- MAI Font Awesome, Hero Icons, o altre librerie icone

### Formattazione numeri
- Stile italiano: `n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
- Date: formato italiano `dd/MM/yyyy` o `toLocaleDateString("it-IT", {...})`

### ⛔ NON fare MAI
- Dark mode (non previsto)
- Animazioni complesse (solo `transition` / `transition-all` su hover)
- Colori fuori palette senza motivo
- Border radius diversi da `rounded-lg` (input) / `rounded-xl` (card, bottoni) / `rounded-2xl` (login card)
- Font custom (usiamo il default di Tailwind: Inter/system)
- Box shadow diversi da `shadow-sm` (card) / `shadow-xl` (sidebar) / `shadow-2xl` (login)

---

## 6. RBAC — Sistema permessi

### Come funziona
1. Utente → ha ruoli (`auth.user_roles`)
2. Ruolo → ha permessi (`auth.role_permissions`)
3. Permessi hanno scope (`auth.role_permission_scopes` → `auth.scopes`)
4. Override utente possibili (`auth.user_permission_scopes`) con `effect: allow | deny`
5. Admin bypass: `system.admin` + scope `GLOBAL` salta tutto

### Scope types
- `GLOBAL` — accesso a tutto
- `ENTITY` — accesso a una entity (es: IT01)
- `STORE` — accesso a uno store specifico
- `MODULE` — accesso a un modulo senza contesto entity/store

### Come proteggere un endpoint
```python
@router.get(
    "/my-endpoint",
    response_model=MyResponse,
    dependencies=[Depends(require_permission("modulo.azione"))],
)
async def my_endpoint(db: AsyncSession = Depends(get_db)):
    ...
```

### Come estrarre entity/store dal contesto
Il sistema cerca automaticamente in: path params → query params → header `X-Entity-Code` / `X-Store-Code`

### Permessi esistenti (formato `modulo.azione`)
```
system.admin
sales.view
sales.import
sales.export
stores.view
stores.exclude_manage
nav.credentials.view
nav.credentials.manage
users.view
users.manage
inventory.view        (futuro)
inventory.edit        (futuro)
```

### Quando aggiungi un nuovo permesso
1. Aggiungi il permesso nella migration Alembic (tabella `auth.permissions`)
2. Assegnalo ai ruoli appropriati (tabella `auth.role_permissions`)
3. Crea gli scope necessari (tabella `auth.scopes`)
4. Collega scope ai role_permissions (tabella `auth.role_permission_scopes`)

---

## 7. DATABASE — Convenzioni

### Schema
- `auth` — utenti, ruoli, permessi, scope, assignments
- `ho` — dati operativi Head Office (sales, nav_credentials, excluded_stores)
- Futuri: `inventory`, `dm`, `store` (1 schema per dominio macro)

### Migrazioni
```bash
# Creare una nuova migrazione
alembic revision --autogenerate -m "descrizione_breve"

# Naming file migrazione: prefisso coerente
# Formato: {hash}_{descrizione}.py  OPPURE  {data}_{numero}_{descrizione}.py
```

### Pattern tabella standard
```python
class MyTable(Base):
    __tablename__ = "my_table"
    __table_args__ = {"schema": "ho"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # ... campi ...
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
```

### Nota sui modelli
I modelli in `rbac_scope.py` usano il nuovo stile `Mapped[T]` + `mapped_column()`.
I modelli in `auth.py` e `ho.py` usano lo stile classico `Column(...)`.
**Per nuovi modelli**: usa lo stile che preferisci ma sii coerente ALL'INTERNO dello stesso file.
Il progetto accetta entrambi gli stili.

---

## 8. API — Convenzioni

### Formato URL
```
/api/{area}/{modulo}/{risorsa}
```
Esempi:
- `/api/auth/login`
- `/api/ho/sales/excluded-stores`
- `/api/ho/sales/parse`
- `/api/ho/sales/nav-credentials`

### Risposte
- Successo: restituisci il Pydantic model direttamente (FastAPI serializza)
- Errore: `HTTPException(status_code=..., detail="messaggio")`
- Delete/azione: `{"message": "descrizione"}` dict semplice

### Health check
```
GET /api/health → {"status": "ok", "service": "FTC HUB"}
```
Non modificare mai questo endpoint.

---

## 9. DOCKER — Comandi principali

```bash
# Avvio tutto
docker compose up -d

# Rebuild backend dopo modifiche a requirements.txt o Dockerfile
docker compose up -d --build backend

# Logs
docker compose logs -f backend

# Migrazione dentro il container
docker compose exec backend alembic upgrade head

# Shell nel container
docker compose exec backend bash
```

### Variabili d'ambiente
Definite in `docker-compose.yml` e/o `.env`. Non hardcodare mai URL o credenziali nel codice.

---

## 10. GIT — Convenzioni commit

### Formato
```
tipo(scope): descrizione breve

Corpo opzionale con dettagli
```

### Tipi
- `feat` — nuova funzionalità
- `fix` — bug fix
- `refactor` — refactoring senza cambiare comportamento
- `migration` — nuova migrazione Alembic
- `style` — modifiche UI/CSS
- `docs` — documentazione
- `chore` — configurazione, dipendenze

### Esempi
```
feat(ho/sales): add IT03 sales parsing endpoint
fix(auth): refresh token not revoking on logout
migration(rbac): add scopes table and seed data
style(sidebar): fix active link highlight color
```

### ⛔ Vietato nei commit
- **NON includere** riferimenti a modelli o strumenti di IA nel messaggio di commit (es. "Co-Authored-By: Claude", "Generated with Claude", "Claude Sonnet", ecc.)
- Il commit deve sembrare scritto da uno sviluppatore umano, senza tracce di assistenza AI

---

## 11. CHECKLIST PRIMA DI OGNI MODIFICA

Prima di scrivere codice, verifica:

- [ ] Ho letto la struttura del modulo che sto toccando?
- [ ] Il nuovo endpoint ha `require_permission()`?
- [ ] Il nuovo permesso è nel formato `modulo.azione`?
- [ ] La tabella ha `__table_args__ = {"schema": "..."}` ?
- [ ] La tabella ha `id UUID`, `is_active`, `created_at`?
- [ ] Lo schema Pydantic ha `ConfigDict(from_attributes=True)`?
- [ ] La migrazione Alembic è stata creata (no `create_all`)?
- [ ] Il nuovo modello è importato in `main.py`?
- [ ] Il frontend usa `apiClient` (non fetch/axios diretto)?
- [ ] I colori rispettano la palette (#1e3a5f, #2563eb, gray-50, ecc.)?
- [ ] Le card usano `rounded-xl border border-gray-200 shadow-sm`?
- [ ] Le icone sono da `lucide-react`?
- [ ] I numeri sono formattati in stile italiano?

---

## 12. ACCESSIBILITÀ — WCAG 2.1 Livello AA (obbligatorio)

Il progetto è destinato alla commercializzazione ed è soggetto all'**European Accessibility Act (Direttiva 2019/882)**, recepita in Italia dal **28 giugno 2025**. Ogni componente UI DEVE rispettare la conformità **WCAG 2.1 livello AA**.

### Regole obbligatorie

#### Testo alternativo per elementi non testuali (WCAG 1.1.1)
- Ogni `<button>` con sola icona DEVE avere `aria-label="..."` descrittivo
- Icone puramente decorative DEVONO avere `aria-hidden="true"`
- Icone che trasmettono informazioni DEVONO avere `aria-label` o testo visibile

```jsx
// ✅ Corretto
<button aria-label="Chiudi"><X size={16} /></button>
<button aria-label="Pagina precedente"><ChevronLeft size={14} /></button>

// ✅ Icona decorativa
<LifeBuoy size={18} aria-hidden="true" />

// ❌ Sbagliato
<button><X size={16} /></button>
```

#### Contrasto colori (WCAG 1.4.3)
- Testo normale: rapporto minimo **4.5:1**
- Testo grande (18px+ o 14px bold): rapporto minimo **3:1**
- **NON usare** `text-gray-300` o `text-gray-400` su sfondo bianco per testo informativo → usa almeno `text-gray-500`

#### Form accessibili (WCAG 1.3.1, 3.3.2)
- Ogni `<input>`, `<select>`, `<textarea>` DEVE avere una `<label>` associata tramite `htmlFor` + `id`
- Il `placeholder` NON sostituisce la `<label>`

```jsx
// ✅ Corretto
<label htmlFor="store-code" className="sr-only">Codice store</label>
<input id="store-code" placeholder="Codice store *" ... />

// ❌ Sbagliato
<input placeholder="Codice store *" ... />
```

#### Tabelle dati (WCAG 1.3.1)
- Ogni `<th>` DEVE avere `scope="col"` (intestazione colonna) o `scope="row"` (intestazione riga)

```jsx
// ✅ Corretto
<th scope="col" className="px-4 py-3">Titolo</th>

// ❌ Sbagliato
<th className="px-4 py-3">Titolo</th>
```

#### Navigazione da tastiera (WCAG 2.1.1, 2.4.7)
- Tutti i controlli interattivi DEVONO essere raggiungibili con Tab
- NON usare `tabIndex={-1}` su controlli che l'utente deve poter attivare
- Il focus DEVE essere visibile: aggiungi `focus-visible:ring-2 focus-visible:ring-[#2563eb]` ai bottoni custom
- I `<div>` con `onClick` interattivi DEVONO diventare `<button>` o avere `role` + `tabIndex={0}`

#### Semantica (WCAG 4.1.2)
- Usa elementi HTML semantici (`<button>`, `<nav>`, `<main>`, `<header>`) invece di `<div>` generici per elementi interattivi
- I modali aperti DEVONO ricevere il focus automaticamente sull'elemento principale

### Checklist accessibilità (aggiunta alla checklist di sezione 11)
- [ ] I bottoni con sole icone hanno `aria-label`?
- [ ] Le icone decorative hanno `aria-hidden="true"`?
- [ ] Ogni input ha una `<label>` associata (non solo placeholder)?
- [ ] Le tabelle hanno `scope="col"` sulle intestazioni?
- [ ] Il contrasto del testo è almeno 4.5:1 (no `text-gray-300/400` su bianco)?
- [ ] Tutti i controlli sono raggiungibili da tastiera?
- [ ] Il focus visibile è presente su ogni elemento interattivo?

---

## 13. CONTROLLO ACCESSI — Regola fondamentale

### Il pannello di comando sono le griglie in Gestione Utenti

La visibilità di moduli e utility per ogni utente è controllata **esclusivamente** dalle due griglie amministrative:

- **Accesso Moduli** (`/admin` → tab "Accesso Moduli") — moduli principali dell'app
- **Accesso Utilities** (`/admin` → tab "Utilities") — utility specifiche (Info Stores, Sales Data, Stock NAV, ItemList, ecc.)

Ogni department ha una riga nella griglia con interruttori ON/OFF per `can_view` e `can_manage`. Il sistema legge il department dell'utente loggato e mostra/nasconde i contenuti di conseguenza.

### Regole rigide

- **MAI liste hardcoded** nel frontend che decidono chi vede cosa (es. `const TIPI_CHE_VEDONO = ["IT", "COMMERCIAL"]`)
- **MAI condizioni su `user.department`** per mostrare card, menu o sezioni legate ai moduli/utility
- La visibilità si legge **sempre** da `canView(moduleCode)` / `canManage(moduleCode)` o dall'API `/api/utilities/my-access`
- **Genera Tabelle** e **Consulta Database** sono contenitori: visibili solo se almeno una sotto-utility è abilitata per quel department
- **Gestione Utenti** e **Configurazione Ticket** sono funzioni IT/ADMIN per natura: sempre visibili a `ADMIN`, `SUPERUSER`, `IT` — non vanno in griglia

### Quando aggiungi una nuova utility o modulo
1. Aggiungila alla griglia (`UTILITY_TABLES` in `UtilitiesConfig.jsx` o equivalente per moduli)
2. Aggiungila a `UTILITY_MODULES` in `access.py`
3. Crea la migration Alembic con i valori di default per ogni department
4. La card nella dashboard si mostra/nasconde automaticamente via `canView`

---

## 14. ERRORI COMUNI DA EVITARE

1. **Creare tabelle con `create_all()`** → Usa SEMPRE Alembic
2. **Dimenticare lo schema PostgreSQL** → Ogni tabella DEVE avere `{"schema": "auth"}` o `{"schema": "ho"}`
3. **Endpoint senza RBAC** → Ogni endpoint DEVE avere `require_permission()`
4. **Usare `fetch()` nel frontend** → Usa `apiClient` da `@/api/client`
5. **Installare librerie UI non previste** → Solo Radix UI + Tailwind + Lucide
6. **Usare colori random** → Attieniti alla palette
7. **Sync SQLAlchemy** → Tutto async (AsyncSession, create_async_engine)
8. **Dimenticare il router in main.py** → Sempre `app.include_router(nuovo_router.router)`
9. **Cambiare `client.js`** → Il sistema di interceptors e refresh è stabile, non toccarlo
10. **Mettere business logic nei router** → Router thin, logica nei `services/`
11. **Liste hardcoded per visibilità moduli** → Usa sempre le griglie di Gestione Utenti (vedi sezione 13)

---

## 15. CONTESTO BUSINESS

- **Entity**: IT01, IT02, IT03 (divisioni geografiche/legali italiane)
- **Store**: codici tipo IT207, IT315, ecc. (150+ negozi)
- **NAV/Navision**: ERP legacy da cui si importano dati TSV (copia-incolla manuale)
- **Sales Data**: dati vendite giornalieri per entity, parsati da TSV con formato numeri italiano
- **Excluded Stores**: negozi esclusi dai calcoli (chiusi, restyling, new opening)
- **Lingua UI**: Italiano per label e messaggi, Inglese per codice e API
- **Utenti target**: non tecnici (HO, DM, Store manager) — UI deve essere semplice e chiara
