@echo off
setlocal
:: ============================================================
:: FTC HUB - Installa NAV Agent
::
:: Copia FTCHubNavAgent.exe + ftchub_nav_agent.ps1 in
:: %LOCALAPPDATA%\FTCHub\ e registra l'autostart in HKCU\Run.
:: Registra anche il protocol handler ftchub-agent:// .
::
:: Eseguire una sola volta per PC. Nessun privilegio admin.
:: ============================================================

set "SRC_DIR=%~dp0"
set "DEST_DIR=%LOCALAPPDATA%\FTCHub"
set "AGENT_EXE=%DEST_DIR%\FTCHubNavAgent.exe"
set "AGENT_PS1=%DEST_DIR%\ftchub_nav_agent.ps1"

:: Verifica presenza sorgenti nel pacchetto scaricato
if not exist "%SRC_DIR%FTCHubNavAgent.exe" (
    echo [ERRORE] FTCHubNavAgent.exe non trovato nel pacchetto.
    pause
    exit /b 1
)
if not exist "%SRC_DIR%ftchub_nav_agent.ps1" (
    echo [ERRORE] ftchub_nav_agent.ps1 non trovato nel pacchetto.
    pause
    exit /b 1
)

:: Crea cartella di installazione
if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"

:: Se una vecchia istanza e' gia' in esecuzione, la fermiamo per poter sovrascrivere i file
taskkill /F /IM FTCHubNavAgent.exe >nul 2>&1
:: Il wrapper lancia powershell.exe che poi diventa il processo dell'agent:
:: chiudiamo le istanze con la finestra ftchub (match best-effort su WindowTitle)
for /f "tokens=2 delims=," %%P in ('tasklist /FI "IMAGENAME eq powershell.exe" /FO CSV /NH 2^>nul ^| findstr /I "powershell"') do (
    rem no-op: non filtriamo per evitare di chiudere altre sessioni ps dell'utente
)

:: Copia i file nella destinazione
copy /Y "%SRC_DIR%FTCHubNavAgent.exe" "%AGENT_EXE%" >nul
if errorlevel 1 (
    echo [ERRORE] Impossibile copiare FTCHubNavAgent.exe in %DEST_DIR%
    pause
    exit /b 1
)
copy /Y "%SRC_DIR%ftchub_nav_agent.ps1" "%AGENT_PS1%" >nul
if errorlevel 1 (
    echo [ERRORE] Impossibile copiare ftchub_nav_agent.ps1 in %DEST_DIR%
    pause
    exit /b 1
)

:: Registra autostart in HKCU\...\Run (piu' pulito della cartella Startup)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "FTCHubNavAgent" /t REG_SZ /d "\"%AGENT_EXE%\"" /f >nul

:: Registra protocol handler ftchub-agent:// (HKCU, non richiede admin)
reg add "HKCU\Software\Classes\ftchub-agent" /ve /d "URL:FTC HUB Agent" /f >nul 2>&1
reg add "HKCU\Software\Classes\ftchub-agent" /v "URL Protocol" /d "" /f >nul 2>&1
reg add "HKCU\Software\Classes\ftchub-agent\shell\open\command" /ve /d "\"%AGENT_EXE%\"" /f >nul 2>&1

:: Avvia subito l'agente in background
start "" "%AGENT_EXE%"

echo.
echo  Agente installato in:
echo    %DEST_DIR%
echo.
echo  Si avviera automaticamente ad ogni accesso Windows.
echo.
pause
endlocal
