@echo off
if not exist ftc_hub_dump.sql (
    echo ERRORE: file ftc_hub_dump.sql non trovato nella cartella corrente.
    exit /b 1
)
echo Ripristino database sulla macchina aziendale...
docker cp ftc_hub_dump.sql ftc_hub_db:/tmp/ftc_hub_dump.sql
echo Elimino e ricreo il database...
docker exec ftc_hub_db psql -U ftc_admin -d postgres -c "DROP DATABASE IF EXISTS ftc_hub;"
docker exec ftc_hub_db psql -U ftc_admin -d postgres -c "CREATE DATABASE ftc_hub OWNER ftc_admin;"
echo Importo i dati...
docker exec ftc_hub_db psql -U ftc_admin -d ftc_hub -f /tmp/ftc_hub_dump.sql
echo.
echo Ripristino completato!
