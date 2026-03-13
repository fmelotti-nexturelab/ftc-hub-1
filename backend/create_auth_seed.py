import asyncio
import uuid
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.auth import Role, Permission, RolePermission


ROLES = [
    ("ADMIN", "Administrator"),
    ("HO", "Head Office"),
    ("DM", "District Manager"),
    ("STORE", "Store User"),
]

PERMISSIONS = [
    ("users.view", "View users", "auth"),
    ("users.create", "Create users", "auth"),
    ("users.edit", "Edit users", "auth"),
    ("users.disable", "Disable users", "auth"),

    ("sales.view", "View sales data", "sales"),
    ("sales.import", "Import sales data", "sales"),
    ("sales.export", "Export sales data", "sales"),

    ("stores.view", "View stores", "stores"),
    ("stores.exclude_manage", "Manage excluded stores", "stores"),

    ("nav.credentials.view", "View NAV credentials", "nav"),
    ("nav.credentials.manage", "Manage NAV credentials", "nav"),

    ("system.admin", "System administration", "system"),
]


async def seed_roles(session):
    roles = {}

    for code, name in ROLES:
        result = await session.execute(
            select(Role).where(Role.code == code)
        )
        role = result.scalar_one_or_none()

        if not role:
            role = Role(
                id=uuid.uuid4(),
                code=code,
                name=name
            )
            session.add(role)

        roles[code] = role

    await session.flush()
    return roles


async def seed_permissions(session):
    permissions = {}

    for code, name, module in PERMISSIONS:
        result = await session.execute(
            select(Permission).where(Permission.code == code)
        )
        perm = result.scalar_one_or_none()

        if not perm:
            perm = Permission(
                id=uuid.uuid4(),
                code=code,
                name=name,
                module=module
            )
            session.add(perm)

        permissions[code] = perm

    await session.flush()
    return permissions


async def assign_permissions(session, roles, permissions):

    admin_perms = permissions.values()

    ho_perms = [
        permissions["sales.view"],
        permissions["sales.import"],
        permissions["sales.export"],
        permissions["stores.view"],
        permissions["stores.exclude_manage"],
        permissions["nav.credentials.view"],
        permissions["nav.credentials.manage"],
    ]

    dm_perms = [
        permissions["sales.view"],
        permissions["stores.view"],
    ]

    store_perms = [
        permissions["sales.view"],
    ]

    mapping = {
        "ADMIN": admin_perms,
        "HO": ho_perms,
        "DM": dm_perms,
        "STORE": store_perms,
    }

    for role_code, perms in mapping.items():
        role = roles[role_code]

        for perm in perms:

            result = await session.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == perm.id
                )
            )

            exists = result.scalar_one_or_none()

            if not exists:
                session.add(
                    RolePermission(
                        id=uuid.uuid4(),
                        role_id=role.id,
                        permission_id=perm.id
                    )
                )


async def main():

    async with AsyncSessionLocal() as session:

        roles = await seed_roles(session)
        permissions = await seed_permissions(session)

        await assign_permissions(session, roles, permissions)

        await session.commit()

        print("Seed auth completato")


if __name__ == "__main__":
    asyncio.run(main())