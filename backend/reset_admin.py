import asyncio
from app.database import AsyncSessionLocal
from app.models.auth import User, UserDepartment
from app.core.security import get_password_hash
from sqlalchemy import select

async def reset():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        user = result.scalar_one_or_none()
        if user:
            user.hashed_password = get_password_hash("Admin@2024!")
            user.department = UserDepartment.SUPERUSER
            await db.commit()
            print(f"Utente: {user.username} | Dipartimento: {user.department} | Password resettata a Admin@2024!")
        else:
            print("Utente admin non trovato!")

asyncio.run(reset())
