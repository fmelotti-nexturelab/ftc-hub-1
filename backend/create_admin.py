import asyncio
import uuid
from app.database import AsyncSessionLocal
from app.models.auth import User, UserDepartment
from app.core.security import get_password_hash

async def create_user():
    async with AsyncSessionLocal() as db:
        u = User(
            id=uuid.uuid4(),
            username="admin",
            email="admin@ftc.com",
            hashed_password=get_password_hash("Admin1234!"),
            department=UserDepartment.SUPERUSER,
            is_active=True,
        )
        db.add(u)
        await db.commit()
        print("Utente admin creato!")

asyncio.run(create_user())
