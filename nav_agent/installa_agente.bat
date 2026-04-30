@echo off
setlocal
:: ============================================================
:: FTC HUB - Installa NAV Agent (versione Python)
::
:: Sostituisce il vecchio FTCHubNavAgent (PowerShell) con il
:: nuovo ftchub-nav-agent.exe (Python / FastAPI).
:: Copia in %LOCALAPPDATA%\FTCHub\ e aggiorna l'autostart.
::
:: Eseguire una sola volta per PC. Non richiede privilegi admin.
:: ============================================================

set "SRC_DIR=%~dp0"
set "DEST_DIR=%LOCALAPPDATA%\FTCHub"
set "NEW_EXE=%DEST_DIR%\ftchub-nav-agent.exe"

:: Verifica presenza sorgente
if not exist "%SRC_DIR%ftchub-nav-agent.exe" (
    echo [ERRORE] ftchub-nav-agent.exe non trovato nel pacchetto.
    pause
    exit /b 1
)

:: Ferma agente vecchio (PowerShell wrapper)
taskkill /F /IM FTCHubNavAgent.exe >nul 2>&1

:: Ferma agente nuovo (se gia' in esecuzione)
taskkill /F /IM ftchub-nav-agent.exe >nul 2>&1

:: Breve attesa per il rilascio dei file
timeout /t 2 /nobreak >nul

:: Crea cartella di installazione se non esiste
if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"

:: Copia il nuovo eseguibile
copy /Y "%SRC_DIR%ftchub-nav-agent.exe" "%NEW_EXE%" >nul
if errorlevel 1 (
    echo [ERRORE] Impossibile copiare ftchub-nav-agent.exe in %DEST_DIR%
    pause
    exit /b 1
)

:: Aggiorna autostart: sovrascrive la chiave esistente con il nuovo exe
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "FTCHubNavAgent" /t REG_SZ /d "\"%NEW_EXE%\"" /f >nul

:: Avvia subito il nuovo agente
start "" "%NEW_EXE%"

echo.
echo  Nuovo agente installato correttamente in:
echo    %DEST_DIR%
echo.
echo  Si avviera automaticamente ad ogni accesso Windows.
echo  Il vecchio agente PowerShell e' stato disattivato.
echo.
pause
endlocal
