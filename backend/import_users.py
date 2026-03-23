"""
Script di import utenti da CSV.
Uso: docker compose exec backend python import_users.py

CSV atteso: username;full_name;email;phone;password;role;department
Separatore: ;
"""

import asyncio
import csv
import uuid
import re
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select, text
from app.database import AsyncSessionLocal
from app.models.auth import User, UserRole, UserDepartment
from app.core.security import get_password_hash

CSV_PATH = "/app/import_users.csv"

ROLE_FIXES = {
    "MANAGER": "HO",
    "HEAD": "HO",
}

USER_TYPE_FIXES = {
    "HO": "COMMERCIAL",
}

def sanitize_username(name: str) -> str:
    return re.sub(r"[^\w@.\-]", "_", name).strip("_")

def derive_entity(store_code: str) -> str:
    return store_code[:4]

async def import_users():
    created = 0
    skipped = 0
    errors = []
    store_assignments = []  # (user_id, entity_code, store_code)

    # --- PASSATA 1: crea tutti gli utenti ---
    async with AsyncSessionLocal() as db:
        with open(CSV_PATH, newline="", encoding="latin-1") as f:
            reader = csv.DictReader(f, delimiter=";")

            for i, row in enumerate(reader, start=2):
                username = row["username"].strip()
                full_name = row["full_name"].strip()
                email = row["email"].strip()
                phone = row["phone"].strip() or None
                password = row["password"].strip()
                role_raw = row["role"].strip()
                department_raw = row["department"].strip()

                if not username or not password:
                    errors.append(f"Riga {i}: username o password mancante — saltato")
                    skipped += 1
                    continue

                role_raw = ROLE_FIXES.get(role_raw, role_raw)
                department_raw = USER_TYPE_FIXES.get(department_raw, department_raw)

                try:
                    role = UserRole(role_raw)
                except ValueError:
                    errors.append(f"Riga {i}: role '{role_raw}' non valido per '{username}' — saltato")
                    skipped += 1
                    continue

                try:
                    department = UserDepartment(department_raw)
                except ValueError:
                    errors.append(f"Riga {i}: department '{department_raw}' non valido per '{username}' — saltato")
                    skipped += 1
                    continue

                if not email:
                    safe = sanitize_username(username).lower()
                    email = f"{safe}@noemail.ftchub"

                existing = await db.execute(select(User).where(User.username == username))
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue

                existing_email = await db.execute(select(User).where(User.email == email))
                if existing_email.scalar_one_or_none():
                    email = f"{sanitize_username(username).lower()}_{i}@noemail.ftchub"

                user_id = uuid.uuid4()
                user = User(
                    id=user_id,
                    username=username,
                    email=email,
                    full_name=full_name or username,
                    hashed_password=get_password_hash(password),
                    role=role,
                    department=department,
                    phone=phone,
                    is_active=True,
                )
                db.add(user)

                if department == UserDepartment.STORE and re.match(r"^IT\d{5}$", username):
                    store_assignments.append((user_id, derive_entity(username), username))

                created += 1

        await db.commit()

    # --- PASSATA 2: crea gli assignments ---
    if store_assignments:
        async with AsyncSessionLocal() as db:
            for user_id, entity_code, store_code in store_assignments:
                await db.execute(text("""
                    INSERT INTO auth.user_assignments
                        (id, user_id, entity_code, store_code, assignment_type, is_active)
                    VALUES
                        (:id, :user_id, :entity_code, :store_code, 'PRIMARY', true)
                """), {
                    "id": str(uuid.uuid4()),
                    "user_id": str(user_id),
                    "entity_code": entity_code,
                    "store_code": store_code,
                })
            await db.commit()

    print(f"\n Creati: {created} utenti")
    print(f"   Saltati: {skipped}")
    print(f"   Assignments store: {len(store_assignments)}")
    if errors:
        print(f"\n Errori ({len(errors)}):")
        for e in errors:
            print(f"   {e}")

if __name__ == "__main__":
    asyncio.run(import_users())
