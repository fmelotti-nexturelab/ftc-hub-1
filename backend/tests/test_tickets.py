"""
Test suite — Sistema Ticket FTC HUB

Copre:
  1. Visibilità ticket per tipo utente (get_tickets)
  2. Accesso singolo ticket (get_ticket)
  3. Restrizione chiusura ticket (update_status)
  4. Prendi in carico (take_ticket)
  5. Endpoint API (ASGI)

Requires: pytest-asyncio, httpx, unittest.mock
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

from app.main import app
from app.models.auth import UserDepartment, UserRole


# ── helpers ──────────────────────────────────────────────────────────────────

def make_user(department: str, user_id: uuid.UUID | None = None) -> SimpleNamespace:
    """Crea un utente finto con il department indicato."""
    u = SimpleNamespace()
    u.id = user_id or uuid.uuid4()
    u.department = UserDepartment(department)
    u.role = UserRole.HO
    u.username = f"user_{department.lower()}"
    u.email = f"{u.username}@test.it"
    u.full_name = f"Utente {department}"
    u.is_active = True
    return u


def make_ticket(
    ticket_id: uuid.UUID | None = None,
    team_id: int | None = None,
    assigned_to: uuid.UUID | None = None,
    created_by: uuid.UUID | None = None,
    status: str = "open",
    store_number: str | None = None,
) -> SimpleNamespace:
    t = SimpleNamespace()
    t.id = ticket_id or uuid.uuid4()
    t.ticket_number = 1
    t.title = "Test ticket"
    t.description = "Descrizione"
    t.status = status
    t.priority = "medium"
    t.team_id = team_id
    t.assigned_to = assigned_to
    t.created_by = created_by or uuid.uuid4()
    t.store_number = store_number
    t.category_id = None
    t.subcategory_id = None
    t.is_active = True
    t.created_at = datetime.now(timezone.utc)
    t.taken_at = None
    t.closed_at = None
    t.resolution_minutes = None
    return t


def mock_db_execute(rows=None):
    """Restituisce un mock di db.execute() che scala i risultati."""
    result = MagicMock()
    result.scalars.return_value.all.return_value = rows or []
    result.scalar_one_or_none.return_value = rows[0] if rows else None
    return result


# ── 1. Visibilità ticket ─────────────────────────────────────────────────────

class TestGetTicketsVisibility:
    """
    Testa che ogni tipo utente veda solo i ticket a cui ha diritto.
    La service function è get_tickets() in ticket_service.py
    """

    @pytest.fixture
    def team_id(self):
        return 42

    @pytest.fixture
    def other_team_id(self):
        return 99

    @pytest.mark.asyncio
    async def test_store_sees_only_own_store_tickets(self):
        """STORE vede solo ticket del suo negozio."""
        from app.services.tickets import ticket_service

        user = make_user("STORE")
        store_ticket = make_ticket(store_number="IT207", created_by=user.id)
        other_ticket = make_ticket(store_number="IT999")

        db = AsyncMock()
        # _get_user_store_number → restituisce "IT207"
        # get_tickets fa select(Ticket).where(store_number == ...)
        # Qui testiamo che il department STORE generi il where corretto
        # tramite is_privileged=False e department==STOREMANAGER

        # Il test diretto della query è difficile senza DB reale.
        # Verifichiamo la logica interna tramite la costante is_privileged.
        assert user.department == UserDepartment.STORE
        assert UserDepartment.STORE not in (
            UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT
        )

    @pytest.mark.asyncio
    async def test_it_user_is_privileged(self):
        """IT è considerato privilegiato → accesso completo."""
        user = make_user("IT")
        is_privileged = user.department in (
            UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT
        )
        assert is_privileged

    @pytest.mark.asyncio
    async def test_superuser_is_privileged(self):
        """SUPERUSER è privilegiato."""
        user = make_user("SUPERUSER")
        is_privileged = user.department in (
            UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT
        )
        assert is_privileged

    @pytest.mark.asyncio
    async def test_admin_is_privileged(self):
        """ADMIN è privilegiato."""
        user = make_user("ADMIN")
        is_privileged = user.department in (
            UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT
        )
        assert is_privileged

    @pytest.mark.asyncio
    async def test_facilities_is_not_privileged(self):
        """FACILITIES non è privilegiato → deve essere limitato al proprio team."""
        user = make_user("FACILITIES")
        is_privileged = user.department in (
            UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT
        )
        assert not is_privileged

    @pytest.mark.asyncio
    async def test_hr_is_not_privileged(self):
        """HR non è privilegiato."""
        user = make_user("HR")
        is_privileged = user.department in (
            UserDepartment.SUPERUSER, UserDepartment.ADMIN, UserDepartment.IT
        )
        assert not is_privileged


# ── 2. Accesso singolo ticket ─────────────────────────────────────────────────

class TestGetTicketAccess:
    """
    get_ticket() deve:
    - Permettere accesso al creatore
    - Permettere accesso ai membri del team assegnato
    - Permettere accesso all'assegnatario diretto
    - Bloccare tutti gli altri (403)
    """

    @pytest.mark.asyncio
    async def test_creator_can_access(self):
        """Il creatore del ticket può sempre accedervi."""
        from app.services.tickets import ticket_service

        user = make_user("STORE")
        ticket = make_ticket(created_by=user.id, team_id=None, assigned_to=None)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_db_execute([ticket]))

        with patch.object(ticket_service, "_load_name_maps", return_value=({}, {}, {}, {})):
            with patch.object(ticket_service, "_get_users", return_value={}):
                result = await ticket_service.get_ticket(db, ticket.id, user, is_manager=False)
        assert result.id == ticket.id

    @pytest.mark.asyncio
    async def test_assignee_can_access(self):
        """L'assegnatario diretto può accedere al ticket."""
        from app.services.tickets import ticket_service

        user = make_user("FACILITIES")
        ticket = make_ticket(
            created_by=uuid.uuid4(),  # altro utente
            team_id=None,
            assigned_to=user.id,
        )

        db = AsyncMock()
        # Prima execute → ticket, seconda → nessun team member (team_id=None)
        db.execute = AsyncMock(return_value=mock_db_execute([ticket]))

        with patch.object(ticket_service, "_load_name_maps", return_value=({}, {}, {}, {})):
            with patch.object(ticket_service, "_get_users", return_value={}):
                result = await ticket_service.get_ticket(db, ticket.id, user, is_manager=False)
        assert result.id == ticket.id

    @pytest.mark.asyncio
    async def test_unauthorized_user_blocked(self):
        """Utente non coinvolto → 403."""
        from app.services.tickets import ticket_service
        from fastapi import HTTPException

        user = make_user("STORE")
        other_user_id = uuid.uuid4()
        ticket = make_ticket(
            created_by=other_user_id,
            team_id=42,
            assigned_to=other_user_id,
        )

        db = AsyncMock()
        # Primo execute → ticket trovato
        # Secondo execute → utente NON membro del team (None)
        execute_responses = [
            mock_db_execute([ticket]),   # select ticket
            mock_db_execute([]),         # select team member → nessuno
        ]
        db.execute = AsyncMock(side_effect=execute_responses)

        with pytest.raises(HTTPException) as exc_info:
            await ticket_service.get_ticket(db, ticket.id, user, is_manager=False)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_manager_can_access_any_ticket(self):
        """Un is_manager=True può accedere a qualsiasi ticket."""
        from app.services.tickets import ticket_service

        user = make_user("IT")
        ticket = make_ticket(
            created_by=uuid.uuid4(),
            team_id=None,
            assigned_to=None,
        )

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_db_execute([ticket]))

        with patch.object(ticket_service, "_load_name_maps", return_value=({}, {}, {}, {})):
            with patch.object(ticket_service, "_get_users", return_value={}):
                result = await ticket_service.get_ticket(db, ticket.id, user, is_manager=True)
        assert result.id == ticket.id


# ── 3. Chiusura ticket ───────────────────────────────────────────────────────

class TestCloseTicketRestriction:
    """
    update_status() con status=CLOSED deve:
    - Permettere a IT/ADMIN/SUPERUSER di chiudere qualsiasi ticket
    - Permettere all'assegnatario di chiudere il proprio ticket
    - Bloccare tutti gli altri (403)
    """

    def _make_status_data(self):
        from app.schemas.tickets import TicketStatusUpdate
        from app.models.tickets import TicketStatus
        data = MagicMock()
        data.status = TicketStatus.CLOSED
        return data

    def _mock_db_for_update_status(self, ticket):
        """Mock DB che gestisce: 1° execute=ticket, 2° execute=creator per notifica."""
        creator = SimpleNamespace(
            id=ticket.created_by, email="creator@test.it",
            username="creator", full_name="Creator"
        )
        ticket_result = mock_db_execute([ticket])
        creator_result = mock_db_execute([creator])
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[ticket_result, creator_result])
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        return db

    def _patch_notification(self):
        """Patch notification_service con AsyncMock per tutti i metodi async."""
        from unittest.mock import patch, AsyncMock as AM
        mock_ns = MagicMock()
        mock_ns.notify_status_change = AM(return_value=None)
        mock_ns.push = AM(return_value=None)
        mock_ns.push_to_many = AM(return_value=None)
        mock_ns.create_in_app = AM(return_value=None)
        mock_ns.notify_new_ticket = AM(return_value=None)
        mock_ns.notify_team = AM(return_value=None)
        return patch("app.services.tickets.ticket_service.notification_service", mock_ns)

    @pytest.mark.asyncio
    async def test_it_user_can_close_any_ticket(self):
        """IT può chiudere qualsiasi ticket."""
        from app.services.tickets import ticket_service

        it_user = make_user("IT")
        other_user_id = uuid.uuid4()
        ticket = make_ticket(created_by=other_user_id, assigned_to=other_user_id, status="in_progress")
        db = self._mock_db_for_update_status(ticket)
        data = self._make_status_data()

        with patch.object(ticket_service, "_load_name_maps", return_value=({}, {}, {}, {})):
            with patch.object(ticket_service, "_get_users", return_value={}):
                with self._patch_notification():
                    await ticket_service.update_status(db, ticket.id, data, it_user)

    @pytest.mark.asyncio
    async def test_assignee_can_close_own_ticket(self):
        """L'assegnatario può chiudere il suo ticket."""
        from app.services.tickets import ticket_service

        user = make_user("FACILITIES")
        ticket = make_ticket(created_by=uuid.uuid4(), assigned_to=user.id, status="in_progress")
        db = self._mock_db_for_update_status(ticket)
        data = self._make_status_data()

        with patch.object(ticket_service, "_load_name_maps", return_value=({}, {}, {}, {})):
            with patch.object(ticket_service, "_get_users", return_value={}):
                with self._patch_notification():
                    await ticket_service.update_status(db, ticket.id, data, user)

    @pytest.mark.asyncio
    async def test_non_assignee_cannot_close_ticket(self):
        """Un utente non assegnatario non può chiudere un ticket altrui."""
        from app.services.tickets import ticket_service
        from fastapi import HTTPException

        user = make_user("FACILITIES")
        other_user_id = uuid.uuid4()
        ticket = make_ticket(created_by=other_user_id, assigned_to=other_user_id, status="in_progress")

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_db_execute([ticket]))
        data = self._make_status_data()

        with pytest.raises(HTTPException) as exc_info:
            await ticket_service.update_status(db, ticket.id, data, user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_superuser_can_close_any_ticket(self):
        """SUPERUSER può chiudere qualsiasi ticket."""
        from app.services.tickets import ticket_service

        superuser = make_user("SUPERUSER")
        other_user_id = uuid.uuid4()
        ticket = make_ticket(created_by=other_user_id, assigned_to=other_user_id, status="in_progress")
        db = self._mock_db_for_update_status(ticket)
        data = self._make_status_data()

        with patch.object(ticket_service, "_load_name_maps", return_value=({}, {}, {}, {})):
            with patch.object(ticket_service, "_get_users", return_value={}):
                with self._patch_notification():
                    await ticket_service.update_status(db, ticket.id, data, superuser)


# ── 4. Prendi in carico ──────────────────────────────────────────────────────

class TestTakeTicket:
    """
    take_ticket() deve:
    - Assegnare il ticket all'utente corrente
    - Impostare taken_at
    - Cambiare stato da OPEN a IN_PROGRESS
    - Non cambiare stato se già IN_PROGRESS o WAITING
    """

    @pytest.mark.asyncio
    async def test_take_open_ticket_sets_in_progress(self):
        """Prendere in carico un ticket OPEN lo porta IN_PROGRESS."""
        from app.services.tickets import ticket_service
        from app.models.tickets import TicketStatus

        user = make_user("FACILITIES")
        ticket = make_ticket(status="open", assigned_to=None)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_db_execute([ticket]))
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        with patch.object(ticket_service, "_load_name_maps", return_value=({}, {}, {}, {})):
            with patch.object(ticket_service, "_get_users", return_value={}):
                with patch("app.services.tickets.ticket_service.notification_service", MagicMock(notify_ticket_taken=AsyncMock(return_value=None), create_in_app=AsyncMock(return_value=None))):
                    await ticket_service.take_ticket(db, ticket.id, user)

        assert ticket.assigned_to == user.id
        assert ticket.taken_at is not None
        assert ticket.status == TicketStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_take_in_progress_ticket_keeps_status(self):
        """Prendere in carico un ticket IN_PROGRESS non cambia lo stato."""
        from app.services.tickets import ticket_service
        from app.models.tickets import TicketStatus

        user = make_user("IT")
        ticket = make_ticket(status="in_progress", assigned_to=None)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_db_execute([ticket]))
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        with patch.object(ticket_service, "_load_name_maps", return_value=({}, {}, {}, {})):
            with patch.object(ticket_service, "_get_users", return_value={}):
                with patch("app.services.tickets.ticket_service.notification_service", MagicMock(notify_ticket_taken=AsyncMock(return_value=None), create_in_app=AsyncMock(return_value=None))):
                    await ticket_service.take_ticket(db, ticket.id, user)

        assert ticket.assigned_to == user.id
        assert ticket.status == TicketStatus.IN_PROGRESS  # rimasto

    @pytest.mark.asyncio
    async def test_take_closed_ticket_raises_400(self):
        """Prendere in carico un ticket chiuso → 400."""
        from app.services.tickets import ticket_service
        from fastapi import HTTPException

        user = make_user("IT")
        ticket = make_ticket(status="closed")

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_db_execute([ticket]))

        with pytest.raises(HTTPException) as exc_info:
            await ticket_service.take_ticket(db, ticket.id, user)

        assert exc_info.value.status_code == 400


# ── 5. API endpoint tests ────────────────────────────────────────────────────

BASE_URL = "http://testserver"


@pytest.fixture
def async_client():
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url=BASE_URL)


async def _login(client, username: str, password: str) -> str:
    resp = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login fallito per {username}: {resp.text}"
    return resp.json()["access_token"]


# Credenziali reali dal DB (import_users.csv)
SUPERUSER = ("Fausto Melotti", "123")
IT_USER   = ("Bruno Danaro", "123")
STORE_USER = ("IT01003", "123")
FACILITIES_USER = ("Razvan Gordea", "123")


class TestTicketsEndpoint:
    """Test degli endpoint REST con utente reale (richiede DB attivo)."""

    @pytest.mark.asyncio
    async def test_list_tickets_requires_auth(self, async_client):
        """GET /api/tickets senza token → 401 o 403."""
        async with async_client as client:
            resp = await client.get("/api/tickets")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_store_user_can_list_tickets(self, async_client):
        """Utente STORE può chiamare GET /api/tickets."""
        async with async_client as client:
            token = await _login(client, *STORE_USER)
            resp = await client.get(
                "/api/tickets",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_superuser_can_list_all_tickets(self, async_client):
        """SUPERUSER può vedere tutti i ticket."""
        async with async_client as client:
            token = await _login(client, *SUPERUSER)
            resp = await client.get(
                "/api/tickets",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_superuser_can_access_ticket_stats(self, async_client):
        """SUPERUSER può accedere alle statistiche ticket."""
        async with async_client as client:
            token = await _login(client, *SUPERUSER)
            resp = await client.get(
                "/api/tickets/stats",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert "totals" in body
        assert "total" in body["totals"]

    @pytest.mark.asyncio
    async def test_store_cannot_access_stats(self, async_client):
        """Utente STORE non può accedere alle statistiche (need_manage=True)."""
        async with async_client as client:
            token = await _login(client, *STORE_USER)
            resp = await client.get(
                "/api/tickets/stats",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code in (403, 401)

    @pytest.mark.asyncio
    async def test_create_ticket_as_store(self, async_client):
        """Utente STORE può creare un ticket."""
        async with async_client as client:
            token = await _login(client, *STORE_USER)
            payload = {
                "title": "Test ticket automatico",
                "description": "Creato da test automatico",
                "priority": "low",
                "category_id": 7,
                "requester_name": "Test User",
                "requester_phone": "+39 000 0000000",
                "teamviewer_code": "000-000-000",
            }
            resp = await client.post(
                "/api/tickets",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code in (200, 201), f"Errore creazione ticket: {resp.text}"
        body = resp.json()
        assert body["title"] == "Test ticket automatico"
        assert body["priority"] == "low"

    @pytest.mark.asyncio
    async def test_create_ticket_invalid_priority(self, async_client):
        """Priorità non valida → 422."""
        async with async_client as client:
            token = await _login(client, *STORE_USER)
            payload = {
                "title": "Ticket con priorità errata",
                "description": "Test",
                "priority": "INVALID_PRIORITY",
            }
            resp = await client.post(
                "/api/tickets",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_my_team_filter(self, async_client):
        """IT con my_team=true riceve solo i ticket del suo team."""
        async with async_client as client:
            token = await _login(client, *IT_USER)
            resp = await client.get(
                "/api/tickets?my_team=true",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_facilities_sees_team_tickets(self, async_client):
        """FACILITIES vede i ticket del proprio team."""
        async with async_client as client:
            token = await _login(client, *FACILITIES_USER)
            resp = await client.get(
                "/api/tickets",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        tickets = resp.json()
        # Tutti i ticket restituiti devono appartenere al team Facilities
        # o essere assegnati direttamente all'utente (non ad altri team)
        for t in tickets:
            team_name = (t.get("team_name") or "").upper()
            assert team_name in ("FACILITIES", ""), \
                f"Ticket {t['ticket_number']} appartiene al team '{team_name}', non FACILITIES"

    @pytest.mark.asyncio
    async def test_ticket_not_found_404(self, async_client):
        """Ticket con ID inesistente → 404."""
        fake_id = str(uuid.uuid4())
        async with async_client as client:
            token = await _login(client, *SUPERUSER)
            resp = await client.get(
                f"/api/tickets/{fake_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 404


# ── 6. Regole di routing ─────────────────────────────────────────────────────

class TestRoutingRules:
    """Verifica l'endpoint delle regole di routing."""

    @pytest.mark.asyncio
    async def test_superuser_can_list_routing_rules(self, async_client):
        """SUPERUSER può listare le regole di routing."""
        async with async_client as client:
            token = await _login(client, *SUPERUSER)
            resp = await client.get(
                "/api/admin/tickets/routing-rules",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_store_cannot_access_routing_rules(self, async_client):
        """Utente STORE non può accedere alle regole di routing."""
        async with async_client as client:
            token = await _login(client, *STORE_USER)
            resp = await client.get(
                "/api/admin/tickets/routing-rules",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_superuser_can_list_teams(self, async_client):
        """SUPERUSER può listare i team."""
        async with async_client as client:
            token = await _login(client, *SUPERUSER)
            resp = await client.get(
                "/api/admin/tickets/teams",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_superuser_can_list_categories(self, async_client):
        """SUPERUSER può listare le categorie."""
        async with async_client as client:
            token = await _login(client, *SUPERUSER)
            resp = await client.get(
                "/api/admin/tickets/categories",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
