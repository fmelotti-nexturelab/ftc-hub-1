@echo off
if not exist ftc_hub_dump.dump (
    echo ERRORE: file ftc_hub_dump.dump non trovato nella cartella corrente.
    exit /b 1
)
echo Ripristino database sulla macchina aziendale...
docker cp ftc_hub_dump.dump ftc_hub_db:/tmp/ftc_hub_dump.dump
docker exec ftc_hub_db pg_restore -U ftc_admin -d ftc_hub --clean --if-exists -F c /tmp/ftc_hub_dump.dump
echo.
echo Ripristino completato!
