@echo off
cd /d C:\Projects\FTC_HUB

echo ============================================
echo   FTC HUB - Deploy da Git
echo ============================================
echo.

echo [1/4] Pull codice da GitHub...
git fetch origin
git reset --hard origin/main
echo.

echo [2/4] Rebuild container...
docker compose up -d --build backend frontend
echo.

echo [3/4] Migrazione Alembic...
timeout /t 8 /nobreak >nul
docker compose exec backend alembic upgrade head
echo.

echo [4/4] Verifica...
:wait
curl -s http://localhost:8000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait
)
curl -s http://localhost:8000/api/health
echo.
echo.
echo ============================================
echo   DEPLOY COMPLETATO!
echo ============================================
pause
