@echo off
:: ============================================================
:: FTC HUB - Installa NAV Agent in avvio automatico Windows
:: Eseguire una sola volta per PC. Richiede permessi utente.
:: ============================================================

set AGENT_SRC=%~dp0ftchub_nav_agent.ps1
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP%\ftchub_nav_agent.bat

:: Copia lo script ps1 nella cartella Startup
copy /Y "%AGENT_SRC%" "%STARTUP%\ftchub_nav_agent.ps1" >nul

:: Crea il launcher .bat che avvia lo script nascosto
(
echo @echo off
echo powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%STARTUP%\ftchub_nav_agent.ps1"
) > "%SHORTCUT%"

:: Avvia subito senza aspettare il prossimo riavvio
start "" /B powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%STARTUP%\ftchub_nav_agent.ps1"

echo.
echo  Agente installato e avviato correttamente.
echo  Si avviera automaticamente ad ogni accesso Windows.
echo.
pause
