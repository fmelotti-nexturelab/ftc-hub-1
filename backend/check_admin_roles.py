import asyncio
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.auth import User, Role, UserRoleAssignment


async def main():
    async with AsyncSessionLocal() as session:

        result = await session.execute(
            select(User).where(User.username == "admin")
        )
        user = result.scalar_one()

        result = await session.execute(
            select(Role.code)
            .join(UserRoleAssignment, Role.id == UserRoleAssignment.role_id)
            .where(UserRoleAssignment.user_id == user.id)
        )

        roles = result.scalars().all()

        print("Admin roles:", roles)


asyncio.run(main())