# backend/tests/test_auth_login.py
"""
Test suite for POST /api/auth/login endpoint.

Requires:
  - pytest-asyncio
  - httpx
  - A running PostgreSQL instance with seeded users

pytest.ini / pyproject.toml must include:
  [tool.pytest.ini_options]
  asyncio_mode = "auto"
"""

import pytest
import httpx

from app.main import app

BASE_URL = "http://testserver"
LOGIN_URL = "/api/auth/login"


@pytest.fixture()
def async_client():
    """Yield an httpx.AsyncClient wired to the FastAPI ASGI app."""
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url=BASE_URL)


# ── helpers ──────────────────────────────────────────────────────────

def _assert_successful_login(resp, expected_role: str, expected_user_type: str, expected_username: str):
    """Common assertions for a 200 login response."""
    assert resp.status_code == 200

    body = resp.json()

    # tokens
    assert "access_token" in body and isinstance(body["access_token"], str) and len(body["access_token"]) > 0
    assert "refresh_token" in body and isinstance(body["refresh_token"], str) and len(body["refresh_token"]) > 0
    assert "expires_in" in body and isinstance(body["expires_in"], (int, float)) and body["expires_in"] > 0

    # user object
    user = body.get("user")
    assert user is not None
    assert user["username"] == expected_username
    assert user["role"] == expected_role
    assert user["user_type"] == expected_user_type
    assert "id" in user


# ── 1-3: successful logins ───────────────────────────────────────────

@pytest.mark.parametrize(
    "username, password, expected_role, expected_user_type",
    [
        pytest.param("admin", "Admin@2024!", "ADMIN", "SUPERUSER", id="superuser"),
        pytest.param("IT01001", "111", "STORE", "STORE", id="store"),
        pytest.param("gaesan", "333", "DM", "DM", id="dm"),
    ],
)
async def test_login_success(async_client, username, password, expected_role, expected_user_type):
    async with async_client as client:
        resp = await client.post(LOGIN_URL, json={"username": username, "password": password})

    _assert_successful_login(resp, expected_role, expected_user_type, username)


# ── 4: wrong password ───────────────────────────────────────────────

async def test_login_wrong_password(async_client):
    async with async_client as client:
        resp = await client.post(LOGIN_URL, json={"username": "admin", "password": "WrongPassword!"})

    assert resp.status_code == 401
    body = resp.json()
    assert "detail" in body


# ── 5: non-existent username ────────────────────────────────────────

async def test_login_unknown_user(async_client):
    async with async_client as client:
        resp = await client.post(LOGIN_URL, json={"username": "utente_fantasma", "password": "qualcosa"})

    assert resp.status_code == 401
    body = resp.json()
    assert "detail" in body


# ── 6: empty / missing fields ───────────────────────────────────────

@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"username": "", "password": ""}, id="both_empty"),
        pytest.param({"username": "admin", "password": ""}, id="password_empty"),
        pytest.param({"username": "", "password": "Admin@2024!"}, id="username_empty"),
        pytest.param({}, id="no_fields"),
        pytest.param({"username": "admin"}, id="missing_password"),
        pytest.param({"password": "Admin@2024!"}, id="missing_username"),
    ],
)
async def test_login_empty_fields(async_client, payload):
    async with async_client as client:
        resp = await client.post(LOGIN_URL, json=payload)

    # FastAPI returns 422 for validation errors;
    # some implementations return 401 for empty strings that pass validation
    # but fail authentication — we accept both depending on your schema.
    assert resp.status_code in (401, 422), f"Expected 401 or 422, got {resp.status_code}"