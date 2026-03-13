import asyncio
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.auth import User


async def main():
    async with AsyncSessionLocal() as session:

        result = await session.execute(
            select(User).where(User.username == "admin")
        )

        user = result.scalar_one()

        print("username:", user.username)
        print("email:", user.email)
        print("full_name:", user.full_name)
        print("role:", user.role)
        print("active:", user.is_active)


asyncio.run(main())