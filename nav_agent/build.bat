@echo off
:: Ferma l'agente se in esecuzione (libera il lock sull'exe)
taskkill /F /IM ftchub-nav-agent.exe >nul 2>&1
timeout /t 2 /nobreak >nul

pyinstaller --onefile --name ftchub-nav-agent ^
  --hidden-import win32com ^
  --hidden-import win32com.client ^
  --hidden-import win32com.server ^
  --hidden-import win32com.server.util ^
  --hidden-import win32gui ^
  --hidden-import win32process ^
  --hidden-import win32con ^
  --hidden-import win32api ^
  --hidden-import pywintypes ^
  --hidden-import psutil ^
  --hidden-import openpyxl ^
  --hidden-import openpyxl.cell._writer ^
  nav_agent.py

:: Copia l'exe da dist\ nella cartella corrente (pronto per installa_agente.bat)
if exist dist\ftchub-nav-agent.exe (
    copy /Y dist\ftchub-nav-agent.exe ftchub-nav-agent.exe >nul
    echo [OK] ftchub-nav-agent.exe copiato nella cartella corrente.
) else (
    echo [ERRORE] Build fallita - dist\ftchub-nav-agent.exe non trovato.
)
pause
