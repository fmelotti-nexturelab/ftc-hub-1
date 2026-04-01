@echo off
cd /d C:\windows\system32\ftc-hub

echo ============================================
echo   FTC HUB - Deploy da Git
echo ============================================
echo.

echo [1/5] Allineamento codice con GitHub...
git fetch origin
git reset --hard origin/main
git clean -fd
echo.

echo [2/5] Rebuild container (no cache, produzione 4 worker)...
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache backend frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
echo.

echo [3/5] Attesa avvio database...
:wait_db
docker exec ftc_hub_db pg_isready -U ftc_admin -d ftc_hub >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait_db
)
echo        Database pronto.
echo.

echo [4/5] Migrazione Alembic...
timeout /t 5 /nobreak >nul
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend alembic upgrade head
echo.

echo [5/5] Verifica health...
:wait_health
curl -s http://localhost:8000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait_health
)
echo.
echo ============================================
echo.
echo   DEPLOY COMPLETATO!
echo.
echo   Versione:
git log --oneline -1
echo.
echo   Data:     %date% %time:~0,8%
echo.
echo ============================================
echo.
pause
