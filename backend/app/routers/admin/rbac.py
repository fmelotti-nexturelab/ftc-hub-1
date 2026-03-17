import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.database import get_db
from app.core.dependencies import require_permission
from app.models.auth import Role, Permission, RolePermission, User, UserRoleAssignment
from app.models.rbac_scope import Scope, RolePermissionScope, UserPermissionScope, UserAssignment

router = APIRouter(prefix="/api/admin/rbac", tags=["Admin - RBAC"])

# ── Schemas ──────────────────────────────────────────────────────────────────

class RoleResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    permission_count: int = 0
    model_config = {"from_attributes": True}

class PermissionResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: Optional[str] = None
    module: str
    is_active: bool
    model_config = {"from_attributes": True}

class RolePermissionResponse(BaseModel):
    permission_id: uuid.UUID
    permission_code: str
    permission_name: str
    module: str
    scope_type: str
    scope_code: str
    rps_id: uuid.UUID  # RolePermissionScope id (per delete)

class UserRoleResponse(BaseModel):
    assignment_id: uuid.UUID
    role_id: uuid.UUID
    role_code: str
    role_name: str

class UserOverrideResponse(BaseModel):
    id: uuid.UUID
    permission_id: uuid.UUID
    permission_code: str
    permission_name: str
    scope_type: str
    scope_code: str
    effect: str
    notes: Optional[str] = None

class AddPermissionRequest(BaseModel):
    permission_id: uuid.UUID
    scope_type: str = "GLOBAL"  # default GLOBAL

class AddUserRoleRequest(BaseModel):
    role_id: uuid.UUID

class AddOverrideRequest(BaseModel):
    permission_id: uuid.UUID
    scope_id: uuid.UUID
    effect: str = "allow"
    notes: Optional[str] = None

# ── Roles ─────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[RoleResponse], dependencies=[Depends(require_permission("system.admin"))])
async def list_roles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Role).order_by(Role.name))
    roles = result.scalars().all()

    # count permissions per role
    counts: dict[uuid.UUID, int] = {}
    for role in roles:
        cnt_res = await db.execute(
            select(RolePermissionScope)
            .where(RolePermissionScope.role_id == role.id, RolePermissionScope.is_active == True)
        )
        counts[role.id] = len(cnt_res.scalars().all())

    out = []
    for role in roles:
        r = RoleResponse.model_validate(role)
        r.permission_count = counts.get(role.id, 0)
        out.append(r)
    return out


@router.get("/roles/{role_id}/permissions", response_model=list[RolePermissionResponse], dependencies=[Depends(require_permission("system.admin"))])
async def get_role_permissions(role_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            Permission.id.label("permission_id"),
            Permission.code.label("permission_code"),
            Permission.name.label("permission_name"),
            Permission.module.label("module"),
            Scope.scope_type.label("scope_type"),
            Scope.scope_code.label("scope_code"),
            RolePermissionScope.id.label("rps_id"),
        )
        .select_from(RolePermissionScope)
        .join(Permission, Permission.id == RolePermissionScope.permission_id)
        .join(Scope, Scope.id == RolePermissionScope.scope_id)
        .where(
            RolePermissionScope.role_id == role_id,
            RolePermissionScope.is_active == True,
        )
        .order_by(Permission.module, Permission.code)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        RolePermissionResponse(
            permission_id=row.permission_id,
            permission_code=row.permission_code,
            permission_name=row.permission_name,
            module=row.module,
            scope_type=row.scope_type,
            scope_code=row.scope_code,
            rps_id=row.rps_id,
        )
        for row in rows
    ]


@router.post("/roles/{role_id}/permissions", status_code=201, dependencies=[Depends(require_permission("system.admin"))])
async def add_role_permission(role_id: uuid.UUID, data: AddPermissionRequest, db: AsyncSession = Depends(get_db)):
    # verifica ruolo e permesso esistano
    role_res = await db.execute(select(Role).where(Role.id == role_id))
    if not role_res.scalar_one_or_none():
        raise HTTPException(404, "Ruolo non trovato")
    perm_res = await db.execute(select(Permission).where(Permission.id == data.permission_id))
    if not perm_res.scalar_one_or_none():
        raise HTTPException(404, "Permesso non trovato")

    # trova/crea scope GLOBAL (o quello richiesto)
    scope_res = await db.execute(
        select(Scope).where(Scope.scope_type == data.scope_type, Scope.scope_code == data.scope_type)
    )
    scope = scope_res.scalar_one_or_none()
    if not scope:
        raise HTTPException(400, f"Scope '{data.scope_type}' non trovato nel DB")

    # verifica role_permissions join
    rp_res = await db.execute(
        select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == data.permission_id,
        )
    )
    rp = rp_res.scalar_one_or_none()
    if not rp:
        rp = RolePermission(role_id=role_id, permission_id=data.permission_id)
        db.add(rp)
        await db.flush()

    # verifica duplicato scope — se esiste ma inattivo, riattiva
    existing = await db.execute(
        select(RolePermissionScope).where(
            RolePermissionScope.role_id == role_id,
            RolePermissionScope.permission_id == data.permission_id,
            RolePermissionScope.scope_id == scope.id,
        )
    )
    existing_rps = existing.scalar_one_or_none()
    if existing_rps:
        if existing_rps.is_active:
            raise HTTPException(409, "Permesso già assegnato con questo scope")
        existing_rps.is_active = True
        await db.commit()
        return {"message": "Permesso riattivato"}

    rps = RolePermissionScope(
        role_id=role_id,
        permission_id=data.permission_id,
        scope_id=scope.id,
    )
    db.add(rps)
    await db.commit()
    return {"message": "Permesso aggiunto"}


@router.delete("/roles/{role_id}/permissions/{rps_id}", dependencies=[Depends(require_permission("system.admin"))])
async def remove_role_permission(role_id: uuid.UUID, rps_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RolePermissionScope).where(
            RolePermissionScope.id == rps_id,
            RolePermissionScope.role_id == role_id,
        )
    )
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(404, "Assegnazione non trovata")
    rps.is_active = False
    await db.commit()
    return {"message": "Permesso rimosso"}

# ── Permissions list ──────────────────────────────────────────────────────────

@router.get("/permissions", response_model=list[PermissionResponse], dependencies=[Depends(require_permission("system.admin"))])
async def list_permissions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Permission).where(Permission.is_active == True).order_by(Permission.module, Permission.code)
    )
    return [PermissionResponse.model_validate(p) for p in result.scalars().all()]

# ── Scopes list ───────────────────────────────────────────────────────────────

@router.get("/scopes", dependencies=[Depends(require_permission("system.admin"))])
async def list_scopes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scope).where(Scope.is_active == True).order_by(Scope.scope_type, Scope.scope_code)
    )
    scopes = result.scalars().all()
    return [{"id": str(s.id), "scope_type": s.scope_type, "scope_code": s.scope_code, "description": s.description} for s in scopes]

# ── User roles ────────────────────────────────────────────────────────────────

@router.get("/users/{user_id}/roles", response_model=list[UserRoleResponse], dependencies=[Depends(require_permission("system.admin"))])
async def get_user_roles(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(UserRoleAssignment.id.label("assignment_id"), Role.id.label("role_id"), Role.code.label("role_code"), Role.name.label("role_name"))
        .join(Role, Role.id == UserRoleAssignment.role_id)
        .where(UserRoleAssignment.user_id == user_id)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [UserRoleResponse(assignment_id=r.assignment_id, role_id=r.role_id, role_code=r.role_code, role_name=r.role_name) for r in rows]


@router.post("/users/{user_id}/roles", status_code=201, dependencies=[Depends(require_permission("system.admin"))])
async def add_user_role(user_id: uuid.UUID, data: AddUserRoleRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(UserRoleAssignment).where(UserRoleAssignment.user_id == user_id, UserRoleAssignment.role_id == data.role_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Ruolo già assegnato")
    db.add(UserRoleAssignment(user_id=user_id, role_id=data.role_id))
    await db.commit()
    return {"message": "Ruolo assegnato"}


@router.delete("/users/{user_id}/roles/{assignment_id}", dependencies=[Depends(require_permission("system.admin"))])
async def remove_user_role(user_id: uuid.UUID, assignment_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserRoleAssignment).where(UserRoleAssignment.id == assignment_id, UserRoleAssignment.user_id == user_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(404, "Assegnazione non trovata")
    await db.delete(assignment)
    await db.commit()
    return {"message": "Ruolo rimosso"}

# ── User permission overrides ─────────────────────────────────────────────────

@router.get("/users/{user_id}/overrides", response_model=list[UserOverrideResponse], dependencies=[Depends(require_permission("system.admin"))])
async def get_user_overrides(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            UserPermissionScope.id.label("id"),
            UserPermissionScope.permission_id.label("permission_id"),
            Permission.code.label("permission_code"),
            Permission.name.label("permission_name"),
            Scope.scope_type.label("scope_type"),
            Scope.scope_code.label("scope_code"),
            UserPermissionScope.effect.label("effect"),
            UserPermissionScope.notes.label("notes"),
        )
        .join(Permission, Permission.id == UserPermissionScope.permission_id)
        .join(Scope, Scope.id == UserPermissionScope.scope_id)
        .where(UserPermissionScope.user_id == user_id, UserPermissionScope.is_active == True)
        .order_by(Permission.module, Permission.code)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        UserOverrideResponse(
            id=r.id,
            permission_id=r.permission_id,
            permission_code=r.permission_code,
            permission_name=r.permission_name,
            scope_type=r.scope_type,
            scope_code=r.scope_code,
            effect=r.effect,
            notes=r.notes,
        )
        for r in rows
    ]


@router.post("/users/{user_id}/overrides", status_code=201, dependencies=[Depends(require_permission("system.admin"))])
async def add_user_override(user_id: uuid.UUID, data: AddOverrideRequest, db: AsyncSession = Depends(get_db)):
    ups = UserPermissionScope(
        user_id=user_id,
        permission_id=data.permission_id,
        scope_id=data.scope_id,
        effect=data.effect,
        notes=data.notes,
    )
    db.add(ups)
    await db.commit()
    await db.refresh(ups)
    return {"message": "Override aggiunto", "id": str(ups.id)}


@router.delete("/users/{user_id}/overrides/{override_id}", dependencies=[Depends(require_permission("system.admin"))])
async def remove_user_override(user_id: uuid.UUID, override_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserPermissionScope).where(UserPermissionScope.id == override_id, UserPermissionScope.user_id == user_id)
    )
    ups = result.scalar_one_or_none()
    if not ups:
        raise HTTPException(404, "Override non trovato")
    ups.is_active = False
    await db.commit()
    return {"message": "Override rimosso"}

# ── User Assignments ──────────────────────────────────────────────────────────

class UserAssignmentResponse(BaseModel):
    id: uuid.UUID
    entity_code: Optional[str] = None
    store_code: Optional[str] = None
    assignment_type: str
    notes: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}

class AddUserAssignmentRequest(BaseModel):
    entity_code: Optional[str] = None
    store_code: Optional[str] = None
    assignment_type: str = "PRIMARY"
    notes: Optional[str] = None


@router.get("/users/{user_id}/assignments", response_model=list[UserAssignmentResponse], dependencies=[Depends(require_permission("system.admin"))])
async def get_user_assignments(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserAssignment)
        .where(UserAssignment.user_id == user_id, UserAssignment.is_active == True)
        .order_by(UserAssignment.assignment_type, UserAssignment.entity_code, UserAssignment.store_code)
    )
    return [UserAssignmentResponse.model_validate(a) for a in result.scalars().all()]


@router.post("/users/{user_id}/assignments", status_code=201, dependencies=[Depends(require_permission("system.admin"))])
async def add_user_assignment(user_id: uuid.UUID, data: AddUserAssignmentRequest, db: AsyncSession = Depends(get_db)):
    if not data.entity_code and not data.store_code:
        raise HTTPException(400, "Specificare entity_code o store_code")
    assignment = UserAssignment(
        user_id=user_id,
        entity_code=data.entity_code.upper() if data.entity_code else None,
        store_code=data.store_code.upper() if data.store_code else None,
        assignment_type=data.assignment_type,
        notes=data.notes,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return UserAssignmentResponse.model_validate(assignment)


@router.delete("/users/{user_id}/assignments/{assignment_id}", dependencies=[Depends(require_permission("system.admin"))])
async def remove_user_assignment(user_id: uuid.UUID, assignment_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserAssignment).where(UserAssignment.id == assignment_id, UserAssignment.user_id == user_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(404, "Assegnazione non trovata")
    assignment.is_active = False
    await db.commit()
    return {"message": "Assegnazione rimossa"}
