from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import (
    get_current_user,
    get_current_user_permissions,
    require_permission,
)
from app.models.auth import User


router = APIRouter(
    prefix="/api/test-rbac",
    tags=["Test RBAC"],
)


@router.get("/me")
async def who_am_i(
    current_user: User = Depends(get_current_user),
):
    """
    Endpoint base per verificare che il token JWT sia valido
    e che il current user venga risolto correttamente.
    """
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": getattr(current_user, "email", None),
        "is_active": getattr(current_user, "is_active", True),
    }


@router.get("/permissions")
async def my_permissions(
    permissions=Depends(get_current_user_permissions),
):
    """
    Mostra i permessi risolti dell'utente loggato:
    - permessi da ruolo
    - override utente
    - scope associati
    """
    return {
        "count": len(permissions),
        "items": permissions,
    }


@router.get("/admin-only")
async def admin_only(
    current_user: User = Depends(require_permission("system.admin")),
):
    """
    Test admin bypass.
    Deve passare solo se l'utente ha system.admin su GLOBAL.
    """
    return {
        "message": "Access granted: admin only",
        "username": current_user.username,
        "required_permission": "system.admin",
    }


@router.get("/sales/by-entity")
async def sales_by_entity(
    entity_code: str = Query(..., description="Codice entity, es. IT01"),
    current_user: User = Depends(require_permission("sales.view")),
):
    """
    Test entity-based permission.
    Esempio:
    /api/test-rbac/sales/by-entity?entity_code=IT01
    """
    return {
        "message": "Access granted: sales.view on entity",
        "username": current_user.username,
        "entity_code": entity_code,
        "required_permission": "sales.view",
    }


@router.get("/sales/import/by-entity")
async def sales_import_by_entity(
    entity_code: str = Query(..., description="Codice entity, es. IT01"),
    current_user: User = Depends(require_permission("sales.import")),
):
    """
    Test entity-based permission per import.
    Esempio:
    /api/test-rbac/sales/import/by-entity?entity_code=IT02
    """
    return {
        "message": "Access granted: sales.import on entity",
        "username": current_user.username,
        "entity_code": entity_code,
        "required_permission": "sales.import",
    }


@router.get("/inventory/by-store")
async def inventory_by_store(
    store_code: str = Query(..., description="Codice store, es. IT315"),
    current_user: User = Depends(require_permission("inventory.view")),
):
    """
    Test store-based permission.
    Esempio:
    /api/test-rbac/inventory/by-store?store_code=IT315
    """
    return {
        "message": "Access granted: inventory.view on store",
        "username": current_user.username,
        "store_code": store_code,
        "required_permission": "inventory.view",
    }


@router.post("/inventory/edit/by-store")
async def inventory_edit_by_store(
    store_code: str = Query(..., description="Codice store, es. IT315"),
    current_user: User = Depends(require_permission("inventory.edit")),
):
    """
    Test store-based permission in scrittura.
    Esempio:
    POST /api/test-rbac/inventory/edit/by-store?store_code=IT315
    """
    return {
        "message": "Access granted: inventory.edit on store",
        "username": current_user.username,
        "store_code": store_code,
        "required_permission": "inventory.edit",
    }


@router.get("/nav/by-entity")
async def nav_credentials_by_entity(
    entity_code: str = Query(..., description="Codice entity, es. IT01"),
    current_user: User = Depends(require_permission("nav.credentials.view")),
):
    """
    Test permesso NAV entity-based.
    Esempio:
    /api/test-rbac/nav/by-entity?entity_code=IT03
    """
    return {
        "message": "Access granted: nav.credentials.view on entity",
        "username": current_user.username,
        "entity_code": entity_code,
        "required_permission": "nav.credentials.view",
    }


@router.get("/users/manage")
async def users_manage(
    current_user: User = Depends(require_permission("users.manage")),
):
    """
    Endpoint di test per permesso gestionale senza scope specifico.
    """
    return {
        "message": "Access granted: users.manage",
        "username": current_user.username,
        "required_permission": "users.manage",
    }