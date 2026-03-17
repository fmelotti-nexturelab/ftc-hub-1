@echo off
echo Esportazione database locale...
docker exec ftc_hub_db pg_dump -U ftc_admin -d ftc_hub -F c -f /tmp/ftc_hub_dump.dump
docker cp ftc_hub_db:/tmp/ftc_hub_dump.dump ./ftc_hub_dump.dump
echo.
echo Dump salvato in: %CD%\ftc_hub_dump.dump
echo Copia questo file sulla macchina aziendale e lancia db_restore.bat
