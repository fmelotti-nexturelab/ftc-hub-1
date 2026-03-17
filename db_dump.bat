@echo off
echo Esportazione database locale...
docker exec ftc_hub_db pg_dump -U ftc_admin -d ftc_hub --no-owner --no-acl -f /tmp/ftc_hub_dump.sql
docker cp ftc_hub_db:/tmp/ftc_hub_dump.sql ./ftc_hub_dump.sql
echo.
echo Dump salvato in: %CD%\ftc_hub_dump.sql
echo Copia questo file sulla macchina aziendale e lancia db_restore.bat
