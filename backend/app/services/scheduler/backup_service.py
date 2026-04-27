import asyncio
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)


async def run_backup(db: AsyncSession) -> dict:
    """pg_dump del database → BACKUP_PATH/ftc_hub.dump (sovrascrive ogni volta)."""
    backup_dir = Path(settings.BACKUP_PATH)
    backup_dir.mkdir(parents=True, exist_ok=True)

    raw_url = (settings.DATABASE_URL or "").replace("+asyncpg", "")
    parsed = urlparse(raw_url)

    host = parsed.hostname or "db"
    port = str(parsed.port or 5432)
    user = parsed.username or ""
    password = parsed.password or ""
    dbname = parsed.path.lstrip("/")

    output_file = str(backup_dir / "ftc_hub.dump")

    env = {**os.environ, "PGPASSWORD": password}

    proc = await asyncio.create_subprocess_exec(
        "pg_dump",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", dbname,
        "-Fc",
        "-f", output_file,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        msg = stderr.decode().strip()
        raise RuntimeError(f"pg_dump fallito (exit {proc.returncode}): {msg}")

    size_mb = round(Path(output_file).stat().st_size / (1024 * 1024), 2)
    destination_label = os.environ.get("BACKUP_DESTINATION_LABEL", "/mnt/backup")
    msg = f"ftc_hub.dump salvato in {output_file} ({size_mb} MB) — destinazione host: {destination_label}"
    logger.info(msg)

    return {"file": output_file, "size_mb": size_mb, "message": msg}
