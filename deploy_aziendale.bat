@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo   FTC HUB - Deploy su PC Aziendale
echo ============================================================
echo.

:: 1. Verifica Docker
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRORE: Docker non trovato. Installalo prima di procedere.
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRORE: Docker non e' in esecuzione. Avvialo e riprova.
    pause
    exit /b 1
)

echo [1/6] Docker OK
echo.

:: 2. Build e avvio container
echo [2/6] Build e avvio container Docker...
docker compose down
docker compose up -d --build
if %errorlevel% neq 0 (
    echo ERRORE: docker compose up fallito.
    pause
    exit /b 1
)

:: 3. Attendi che il DB sia pronto
echo [3/6] Attesa che il database sia pronto...
:wait_db
docker exec ftc_hub_db pg_isready -U ftc_admin -d ftc_hub >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait_db
)
echo        Database pronto.
echo.

:: 4. Ripristino database (se esiste il dump)
if exist ftc_hub_dump.sql (
    echo [4/6] Ripristino database dal dump...
    docker stop ftc_hub_backend >nul 2>&1
    docker cp ftc_hub_dump.sql ftc_hub_db:/tmp/ftc_hub_dump.sql
    docker exec ftc_hub_db psql -U ftc_admin -d postgres -c "DROP DATABASE IF EXISTS ftc_hub;"
    docker exec ftc_hub_db psql -U ftc_admin -d postgres -c "CREATE DATABASE ftc_hub OWNER ftc_admin;"
    docker exec ftc_hub_db psql -U ftc_admin -d ftc_hub -f /tmp/ftc_hub_dump.sql >nul 2>&1
    docker start ftc_hub_backend >nul 2>&1
    echo        Database ripristinato.
) else (
    echo [4/6] Nessun dump trovato, skip ripristino database.
)
echo.

:: 5. Migrazione Alembic
echo [5/6] Esecuzione migrazioni Alembic...
timeout /t 5 /nobreak >nul
docker compose exec backend alembic upgrade head
echo        Migrazioni completate.
echo.

:: 6. Verifica servizi
echo [6/6] Verifica servizi...
echo.

:: Attendi che il backend risponda
:wait_backend
curl -s http://localhost:8000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait_backend
)

echo ============================================================
echo   DEPLOY COMPLETATO!
echo ============================================================
echo.
echo   Frontend:  https://hub.nexturelab.com (o http://localhost)
echo   Backend:   http://localhost:8000/api/health
echo   Database:  PostgreSQL su porta 5432
echo.
echo   Per l'agente NAV sui PC utente:
echo   copiare navision_agent\installa_agente.bat ed eseguirlo
echo ============================================================
echo.
pause
