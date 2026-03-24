@echo off
setlocal

:: Usa docker dal PATH se disponibile, altrimenti il percorso completo
where docker >nul 2>&1
if %errorlevel% == 0 (
    set DOCKER=docker
) else (
    set DOCKER="C:\Program Files\Docker\Docker\resources\bin\docker.exe"
)

if not exist ftc_hub_dump.sql (
    echo ERRORE: file ftc_hub_dump.sql non trovato nella cartella corrente.
    exit /b 1
)
echo Fermo il backend per liberare le connessioni al DB...
%DOCKER% stop ftc_hub_backend
echo Copio il dump nel container...
%DOCKER% cp ftc_hub_dump.sql ftc_hub_db:/tmp/ftc_hub_dump.sql
echo Elimino e ricreo il database...
%DOCKER% exec ftc_hub_db psql -U ftc_admin -d postgres -c "DROP DATABASE IF EXISTS ftc_hub;"
%DOCKER% exec ftc_hub_db psql -U ftc_admin -d postgres -c "CREATE DATABASE ftc_hub OWNER ftc_admin;"
echo Importo i dati...
%DOCKER% exec ftc_hub_db psql -U ftc_admin -d ftc_hub -f /tmp/ftc_hub_dump.sql
echo Riavvio il backend...
%DOCKER% start ftc_hub_backend
echo.
echo Ripristino completato!
